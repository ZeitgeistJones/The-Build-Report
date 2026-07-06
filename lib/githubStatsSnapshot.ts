import { getRedis } from '@/lib/redis'
import type { GitHubStats } from '@/lib/github'
import { getGitHubStats, enrichGitHubStatsPeriodCounts, githubStatsNeedsActivityRescan } from '@/lib/github'

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

/**
 * Write path — call after getGitHubStats({ fresh: true }) in cron/admin/live fallback.
 * Never overwrites an existing good snapshot with a rate-limited or partial one; on skip
 * it keeps the last good snapshot and returns that snapshot's updatedAt.
 */
export async function syncGitHubStatsSnapshot(stats: GitHubStats): Promise<string> {
  const r = getRedis()

  const existing = await getGitHubStatsForDisplay()
  if (existing) {
    const existingCount = existing.trackableRepos?.length ?? 0
    const incomingCount = stats.trackableRepos?.length ?? 0
    const materiallySmaller =
      existingCount > 0 && incomingCount < existingCount * MIN_TRACKABLE_RETENTION

    if (stats.rateLimited || materiallySmaller) {
      const reason = stats.rateLimited
        ? 'rate-limited scan'
        : `fewer trackable repos (${incomingCount} < ${existingCount})`
      console.warn(`[github-snapshot] skipping overwrite (${reason}); keeping last good snapshot`)
      const existingUpdatedAt = await getGitHubStatsSnapshotUpdatedAt()
      return existingUpdatedAt ?? new Date().toISOString()
    }
  }

  const updatedAt = new Date().toISOString()
  await Promise.all([
    r.set(SNAPSHOT_KEY, stats),
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

/** Just past the daily cron cadence — a snapshot older than this means a cron likely failed. */
export const SNAPSHOT_STALE_MS = 26 * 60 * 60 * 1000
let staleRefreshInFlight = false

export function isSnapshotStale(updatedAt: string | null): boolean {
  if (!updatedAt) return true
  const age = Date.now() - new Date(updatedAt).getTime()
  return !Number.isFinite(age) || age > SNAPSHOT_STALE_MS
}

/**
 * Fire-and-forget refresh when the snapshot is stale. Best-effort: never blocks render,
 * and the module-level flag avoids stacking refreshes when many visitors hit a stale page.
 */
function scheduleStaleSnapshotRefresh(): void {
  if (staleRefreshInFlight) return
  staleRefreshInFlight = true
  void (async () => {
    try {
      const fresh = await getGitHubStats({ fresh: true })
      await syncGitHubStatsSnapshot(fresh)
    } catch (err) {
      console.error('[github-snapshot] stale self-heal refresh failed', err)
    } finally {
      staleRefreshInFlight = false
    }
  })()
}

/** Snapshot first; on miss fetch live GitHub once and persist for subsequent visits. */
export async function loadGitHubStatsForPage(): Promise<{
  stats: GitHubStats | null
  source: 'snapshot' | 'live' | 'none'
}> {
  const cached = await getGitHubStatsForDisplay()
  if (cached) {
    const updatedAt = await getGitHubStatsSnapshotUpdatedAt()
    if (isSnapshotStale(updatedAt) || githubStatsNeedsActivityRescan(cached)) scheduleStaleSnapshotRefresh()
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
  const needsRefresh =
    !cached ||
    isSnapshotStale(updatedAt) ||
    snapshotMissingRecentCommits(cached) ||
    githubStatsNeedsActivityRescan(cached)

  if (cached && !needsRefresh) return enrichGitHubStatsPeriodCounts(cached)

  try {
    const fresh = await getGitHubStats({ fresh: true })
    const enriched = enrichGitHubStatsPeriodCounts(fresh)
    await syncGitHubStatsSnapshot(enriched)
    return enriched
  } catch (err) {
    console.error('[github-snapshot] cron refresh failed', err)
    return cached
  }
}
