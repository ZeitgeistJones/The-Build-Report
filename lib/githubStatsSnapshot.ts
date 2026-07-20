import { getRedis } from '@/lib/redis'
import type { GitHubRepo, GitHubStats } from '@/lib/github'
import {
  getGitHubStats,
  enrichGitHubStatsPeriodCounts,
  githubStatsNeedsActivityRescan,
  fetchTrackableRepoPushes,
  snapshotPushesBehindLive,
  mergePartialGitHubStats,
  refreshReposCommitActivity,
  type TrackableRepoPush,
} from '@/lib/github'

/** Max repos to commit-scan on a homepage catch-up (newest behind first). */
const PAGE_CATCHUP_SLUG_CAP = 15

const SNAPSHOT_KEY = 'build-report:github-stats:snapshot'
const SNAPSHOT_UPDATED_AT_KEY = 'build-report:github-stats:snapshot:updatedAt'

function normalizeStats(raw: unknown): GitHubStats | null {
  if (!raw) return null
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== 'object') return null

  const s = parsed as Record<string, unknown>
  const totalRepos =
    typeof s.totalRepos === 'number'
      ? s.totalRepos
      : typeof s.totalRepos === 'string'
        ? Number(s.totalRepos)
        : NaN
  if (!Number.isFinite(totalRepos)) return null

  return { ...s, totalRepos } as GitHubStats
}

/** Materially smaller than last good = likely a partial/failed scan, not a real shrink. */
const MIN_TRACKABLE_RETENTION = 0.8

/** Full-list but almost no scanned activity (often rate-limit mid-scan). */
function isThinActivityScan(stats: GitHubStats): boolean {
  const trackable = stats.trackableRepos?.length ?? 0
  if (trackable < 20) return false
  const activities = Object.values(stats.repoActivity ?? {})
  const scanned = activities.filter((a) => a.commitsScanned).length
  return scanned < Math.floor(trackable * 0.3)
}

function scannedActivityCount(stats: GitHubStats): number {
  return Object.values(stats.repoActivity ?? {}).filter((a) => a.commitsScanned).length
}

/**
 * Write path — call after getGitHubStats({ fresh: true }) in cron/admin/live fallback.
 * Rate-limited / thin scans merge into the last good snapshot (newest scanned repos keep)
 * instead of discarding the whole refresh. Never seeds Redis from a thin/empty first scan.
 */
export async function syncGitHubStatsSnapshot(stats: GitHubStats): Promise<string> {
  const r = getRedis()
  const existing = await getGitHubStatsForDisplay()
  const incomingCount = stats.trackableRepos?.length ?? 0
  const scanned = scannedActivityCount(stats)
  const thin = isThinActivityScan(stats)

  if (existing) {
    const existingCount = existing.trackableRepos?.length ?? 0
    const materiallySmaller =
      existingCount > 0 && incomingCount < existingCount * MIN_TRACKABLE_RETENTION

    if (stats.rateLimited || thin || materiallySmaller) {
      // Only merge when we actually scanned some repos — list-only merges would
      // bump updatedAt and suppress the live push probe for an hour with no new commits.
      if (scanned > 0) {
        const merged = mergePartialGitHubStats(existing, stats)
        const updatedAt = new Date().toISOString()
        await Promise.all([
          r.set(SNAPSHOT_KEY, merged),
          r.set(SNAPSHOT_UPDATED_AT_KEY, updatedAt),
        ])
        console.warn(
          `[github-snapshot] merged partial scan (scanned=${scanned}, rateLimited=${!!stats.rateLimited}, thin=${thin}, smaller=${materiallySmaller})`,
        )
        return updatedAt
      }

      const reason = stats.rateLimited
        ? 'rate-limited scan'
        : thin
          ? 'thin activity scan'
          : `fewer trackable repos (${incomingCount} < ${existingCount})`
      console.warn(`[github-snapshot] skipping overwrite (${reason}); keeping last good snapshot`)
      const existingUpdatedAt = await getGitHubStatsSnapshotUpdatedAt()
      return existingUpdatedAt ?? new Date().toISOString()
    }
  } else if (stats.rateLimited || thin) {
    console.warn('[github-snapshot] refusing to seed Redis with unusable/rate-limited scan')
    return new Date().toISOString()
  }

  const updatedAt = new Date().toISOString()
  await Promise.all([
    r.set(SNAPSHOT_KEY, enrichGitHubStatsPeriodCounts(stats)),
    r.set(SNAPSHOT_UPDATED_AT_KEY, updatedAt),
  ])
  return updatedAt
}

/** Read path — KV only. Returns null when snapshot has never been written. */
export async function getGitHubStatsForDisplay(): Promise<GitHubStats | null> {
  try {
    const r = getRedis()
    const snapshot = await r.get(SNAPSHOT_KEY)
    return normalizeStats(snapshot)
  } catch (err) {
    console.error('[github-snapshot] read failed', err)
    return null
  }
}

export async function getGitHubStatsSnapshotUpdatedAt(): Promise<string | null> {
  try {
    const r = getRedis()
    return await r.get<string>(SNAPSHOT_UPDATED_AT_KEY)
  } catch {
    return null
  }
}

export async function getGitHubStatsSnapshotDiagnostics(): Promise<{
  updatedAt: string | null
  hasSnapshot: boolean
  totalRepos: number | null
}> {
  try {
    const r = getRedis()
    const [updatedAt, raw] = await Promise.all([
      r.get<string>(SNAPSHOT_UPDATED_AT_KEY),
      r.get(SNAPSHOT_KEY),
    ])
    const stats = normalizeStats(raw)
    return {
      updatedAt: updatedAt ?? null,
      hasSnapshot: stats !== null,
      totalRepos: stats?.totalRepos ?? null,
    }
  } catch {
    return { updatedAt: null, hasSnapshot: false, totalRepos: null }
  }
}

/** Age after which a page load probes live GitHub pushed_at (cheap) before serving snapshot. */
export const SNAPSHOT_PROBE_MS = 60 * 60 * 1000

/** Fallback when probe is unavailable — refresh if snapshot is older than daily cron + buffer. */
export const SNAPSHOT_STALE_MS = 6 * 60 * 60 * 1000

export function snapshotAgeMs(updatedAt: string | null): number | null {
  if (!updatedAt) return null
  const age = Date.now() - new Date(updatedAt).getTime()
  return Number.isFinite(age) ? age : null
}

export function isSnapshotStale(updatedAt: string | null): boolean {
  const age = snapshotAgeMs(updatedAt)
  return age === null || age > SNAPSHOT_STALE_MS
}

/** Refresh pushed_at and append brand-new trackable repos from the live list probe. */
function mergeLiveTrackableRepos(
  repos: GitHubRepo[],
  livePushes: Map<string, TrackableRepoPush>,
): GitHubRepo[] {
  const byName = new Map(repos.map(r => [r.name, r]))

  for (const [name, live] of livePushes) {
    const existing = byName.get(name)
    if (existing) {
      byName.set(name, { ...existing, pushedAt: live.pushedAt })
      continue
    }
    byName.set(name, {
      name,
      description: live.description,
      createdAt: live.createdAt,
      pushedAt: live.pushedAt,
      language: live.language,
    })
  }

  return [...byName.values()].sort(
    (a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime(),
  )
}

async function snapshotNeedsLiveRefresh(
  cached: GitHubStats,
  updatedAt: string | null,
): Promise<{ needsRefresh: boolean; behindSlugs: string[]; reason: string }> {
  if (isSnapshotStale(updatedAt)) {
    return { needsRefresh: true, behindSlugs: [], reason: 'snapshot_stale' }
  }
  if (githubStatsNeedsActivityRescan(cached)) {
    return { needsRefresh: true, behindSlugs: [], reason: 'activity_rescan' }
  }

  const age = snapshotAgeMs(updatedAt)
  if (age === null || age <= SNAPSHOT_PROBE_MS) {
    return { needsRefresh: false, behindSlugs: [], reason: 'snapshot_fresh' }
  }

  try {
    const livePushes = await fetchTrackableRepoPushes()
    const behindSlugs = snapshotPushesBehindLive(cached, livePushes)
    if (behindSlugs.length > 0) {
      return { needsRefresh: true, behindSlugs, reason: 'live_push_ahead' }
    }
    return { needsRefresh: false, behindSlugs: [], reason: 'probe_ok' }
  } catch (err) {
    console.error('[github-snapshot] live push probe failed', err)
    return { needsRefresh: false, behindSlugs: [], reason: 'probe_failed' }
  }
}

async function refreshGitHubStatsSnapshot(): Promise<{
  stats: GitHubStats
  usedSnapshotFallback: boolean
}> {
  const fresh = await getGitHubStats({ fresh: true })
  const enriched = enrichGitHubStatsPeriodCounts(fresh)
  await syncGitHubStatsSnapshot(enriched)

  // After sync, Redis holds either the full scan or a merge with the last good snapshot.
  const stored = await getGitHubStatsForDisplay()
  const existingCount = stored?.trackableRepos?.length ?? 0
  const incomingCount = enriched.trackableRepos?.length ?? 0
  const materiallySmaller =
    existingCount > 0 && incomingCount < existingCount * MIN_TRACKABLE_RETENTION
  const partial = Boolean(enriched.rateLimited || isThinActivityScan(enriched) || materiallySmaller)

  if (partial && stored) {
    return {
      stats: enrichGitHubStatsPeriodCounts(stored),
      usedSnapshotFallback: true,
    }
  }

  return { stats: enriched, usedSnapshotFallback: false }
}

/**
 * Homepage catch-up: scan only the newest behind repos, merge into Redis, return merged stats.
 */
async function catchUpSnapshotFromBehindPushes(
  cached: GitHubStats,
  livePushes: Map<string, TrackableRepoPush>,
  behindSlugs: string[],
): Promise<GitHubStats> {
  const ranked = [...behindSlugs]
    .sort((a, b) => {
      const ta = new Date(livePushes.get(a)?.pushedAt ?? 0).getTime()
      const tb = new Date(livePushes.get(b)?.pushedAt ?? 0).getTime()
      return tb - ta
    })
    .slice(0, PAGE_CATCHUP_SLUG_CAP)

  const pushedAtBySlug = new Map(
    [...livePushes].map(([name, meta]) => [name, meta.pushedAt] as const),
  )

  const { repoActivity, rateLimited } = await refreshReposCommitActivity(ranked, {
    fresh: true,
    pushedAtBySlug,
  })

  const scanned = Object.keys(repoActivity).length
  if (scanned === 0) {
    console.warn(
      `[github-snapshot] catch-up scanned 0/${ranked.length} repos (rateLimited=${rateLimited}); serving snapshot`,
    )
    return enrichGitHubStatsPeriodCounts(cached)
  }

  const repos = mergeLiveTrackableRepos(cached.repos ?? [], livePushes)
  const trackableRepos = mergeLiveTrackableRepos(cached.trackableRepos ?? [], livePushes)

  const incoming: GitHubStats = {
    ...cached,
    totalRepos: Math.max(cached.totalRepos ?? 0, repos.length),
    repos,
    trackableRepos,
    repoActivity,
    rateLimited,
  }

  const merged = mergePartialGitHubStats(cached, incoming)
  const updatedAt = new Date().toISOString()
  const r = getRedis()
  await Promise.all([
    r.set(SNAPSHOT_KEY, merged),
    r.set(SNAPSHOT_UPDATED_AT_KEY, updatedAt),
  ])
  console.warn(
    `[github-snapshot] homepage catch-up merged ${scanned}/${ranked.length} behind repos (rateLimited=${rateLimited})`,
  )
  return merged
}

/**
 * Homepage path — serve Redis snapshot when fresh. If older than 1h and live
 * pushed_at is ahead, await a short targeted commit rescan (not a full scan).
 * Cold start (no snapshot) still falls back to a live fetch.
 */
export async function loadGitHubStatsForPage(): Promise<{
  stats: GitHubStats | null
  source: 'snapshot' | 'live' | 'none'
}> {
  const cached = await getGitHubStatsForDisplay()
  if (cached) {
    const updatedAt = await getGitHubStatsSnapshotUpdatedAt()
    const age = snapshotAgeMs(updatedAt)

    if (age !== null && age <= SNAPSHOT_PROBE_MS) {
      return { stats: enrichGitHubStatsPeriodCounts(cached), source: 'snapshot' }
    }

    try {
      const livePushes = await fetchTrackableRepoPushes()
      const behindSlugs = snapshotPushesBehindLive(cached, livePushes)
      if (behindSlugs.length > 0) {
        const merged = await catchUpSnapshotFromBehindPushes(cached, livePushes, behindSlugs)
        return { stats: merged, source: 'live' }
      }
      // Probe ok — bump updatedAt so the next hour skips the list API.
      const r = getRedis()
      await r.set(SNAPSHOT_UPDATED_AT_KEY, new Date().toISOString())
    } catch (err) {
      console.error('[github-snapshot] homepage catch-up probe/scan failed', err)
    }

    return { stats: enrichGitHubStatsPeriodCounts(cached), source: 'snapshot' }
  }

  try {
    const live = await getGitHubStats()
    const enriched = enrichGitHubStatsPeriodCounts(live)
    try {
      await syncGitHubStatsSnapshot(enriched)
    } catch (err) {
      console.error('[github-snapshot] sync after live fetch failed', err)
    }
    if (enriched.rateLimited) {
      const existing = await getGitHubStatsForDisplay()
      if (existing) {
        return { stats: enrichGitHubStatsPeriodCounts(existing), source: 'snapshot' }
      }
    }
    return { stats: enriched, source: 'live' }
  } catch (err) {
    console.error('[github-snapshot] live fetch failed', err)
    return { stats: null, source: 'none' }
  }
}

function snapshotMissingRecentCommits(stats: GitHubStats): boolean {
  const activities = Object.values(stats.repoActivity)
  if (!activities.length) return true
  const withCommits = activities.filter(a => (a.commits30d ?? 0) > 0 || (a.commitTimestamps?.length ?? 0) > 0)
  if (!withCommits.length) return false
  return withCommits.some(a => !a.recentCommits?.length)
}

/** Cron path — prefer snapshot; refresh when stale or missing recentCommits for active repos. */
export async function loadGitHubStatsForCron(): Promise<GitHubStats | null> {
  const cached = await getGitHubStatsForDisplay()
  const updatedAt = await getGitHubStatsSnapshotUpdatedAt()

  let needsRefresh = !cached
  if (cached) {
    const check = await snapshotNeedsLiveRefresh(cached, updatedAt)
    needsRefresh = needsRefresh || check.needsRefresh || snapshotMissingRecentCommits(cached)
  }

  if (cached && !needsRefresh) return enrichGitHubStatsPeriodCounts(cached)

  try {
    const { stats } = await refreshGitHubStatsSnapshot()
    return stats
  } catch (err) {
    console.error('[github-snapshot] cron refresh failed', err)
    return cached
  }
}
