import { getRedis } from '@/lib/redis'
import type { GitHubStats } from '@/lib/github'
import {
  getGitHubStats,
  enrichGitHubStatsPeriodCounts,
  githubStatsNeedsActivityRescan,
  fetchTrackableRepoPushes,
  snapshotPushesBehindLive,
} from '@/lib/github'

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

/** Rate-limit mid-scan often keeps a full repo list but almost no scanned activity. */
function isUnusableActivityScan(stats: GitHubStats): boolean {
  if (stats.rateLimited) return true
  const trackable = stats.trackableRepos?.length ?? 0
  if (trackable < 20) return false
  const activities = Object.values(stats.repoActivity ?? {})
  const scanned = activities.filter((a) => a.commitsScanned).length
  return scanned < Math.floor(trackable * 0.3)
}

/**
 * Write path — call after getGitHubStats({ fresh: true }) in cron/admin/live fallback.
 * Never overwrites an existing good snapshot with a rate-limited or partial one; on skip
 * it keeps the last good snapshot and returns that snapshot's updatedAt.
 * Never writes a rate-limited/thin scan as the first snapshot either.
 */
export async function syncGitHubStatsSnapshot(stats: GitHubStats): Promise<string> {
  const r = getRedis()
  const unusable = isUnusableActivityScan(stats)

  const existing = await getGitHubStatsForDisplay()
  if (existing) {
    const existingCount = existing.trackableRepos?.length ?? 0
    const incomingCount = stats.trackableRepos?.length ?? 0
    const materiallySmaller =
      existingCount > 0 && incomingCount < existingCount * MIN_TRACKABLE_RETENTION

    if (unusable || materiallySmaller) {
      const reason = stats.rateLimited
        ? 'rate-limited scan'
        : unusable
          ? 'thin activity scan'
          : `fewer trackable repos (${incomingCount} < ${existingCount})`
      console.warn(`[github-snapshot] skipping overwrite (${reason}); keeping last good snapshot`)
      // #region agent log
      fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'grades-fix',hypothesisId:'B',location:'githubStatsSnapshot.ts:sync',message:'skip overwrite',data:{reason,rateLimited:!!stats.rateLimited,unusable,materiallySmaller,incomingCount,existingCount,scanned:Object.values(stats.repoActivity??{}).filter(a=>a.commitsScanned).length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const existingUpdatedAt = await getGitHubStatsSnapshotUpdatedAt()
      return existingUpdatedAt ?? new Date().toISOString()
    }
  } else if (unusable) {
    console.warn('[github-snapshot] refusing to seed Redis with unusable/rate-limited scan')
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'grades-fix',hypothesisId:'B',location:'githubStatsSnapshot.ts:sync',message:'refuse seed unusable scan',data:{rateLimited:!!stats.rateLimited,trackable:stats.trackableRepos?.length??0,scanned:Object.values(stats.repoActivity??{}).filter(a=>a.commitsScanned).length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return new Date().toISOString()
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

/** Age after which a page load probes live GitHub pushed_at (cheap) before serving snapshot. */
export const SNAPSHOT_PROBE_MS = 60 * 60 * 1000

/** Fallback when probe is unavailable — refresh if snapshot is older than daily cron + buffer. */
export const SNAPSHOT_STALE_MS = 6 * 60 * 60 * 1000
let staleRefreshInFlight = false

export function snapshotAgeMs(updatedAt: string | null): number | null {
  if (!updatedAt) return null
  const age = Date.now() - new Date(updatedAt).getTime()
  return Number.isFinite(age) ? age : null
}

export function isSnapshotStale(updatedAt: string | null): boolean {
  const age = snapshotAgeMs(updatedAt)
  return age === null || age > SNAPSHOT_STALE_MS
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

  // Prefer last good snapshot whenever the fresh scan is unusable for grades.
  const existing = await getGitHubStatsForDisplay()
  const existingCount = existing?.trackableRepos?.length ?? 0
  const incomingCount = enriched.trackableRepos?.length ?? 0
  const materiallySmaller =
    existingCount > 0 && incomingCount < existingCount * MIN_TRACKABLE_RETENTION
  const unusable = isUnusableActivityScan(enriched)

  if ((unusable || materiallySmaller) && existing) {
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'grades-fix',hypothesisId:'A',location:'githubStatsSnapshot.ts:refresh',message:'rejected partial live scan; using snapshot',data:{rateLimited:enriched.rateLimited,unusable,materiallySmaller,incomingCount,existingCount,scanned:Object.values(enriched.repoActivity??{}).filter(a=>a.commitsScanned).length,totalCommits30d:enriched.totalCommits30d,snapshotCommits30d:existing.totalCommits30d},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return {
      stats: enrichGitHubStatsPeriodCounts(existing),
      usedSnapshotFallback: true,
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'grades-fix',hypothesisId:'A',location:'githubStatsSnapshot.ts:refresh',message:'using fresh scan',data:{rateLimited:enriched.rateLimited,unusable,incomingCount,totalCommits30d:enriched.totalCommits30d},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { stats: enriched, usedSnapshotFallback: false }
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
      await refreshGitHubStatsSnapshot()
    } catch (err) {
      console.error('[github-snapshot] stale self-heal refresh failed', err)
    } finally {
      staleRefreshInFlight = false
    }
  })()
}

/** Snapshot first; refresh when stale, incomplete, or live GitHub is ahead of cached pushes. */
export async function loadGitHubStatsForPage(): Promise<{
  stats: GitHubStats | null
  source: 'snapshot' | 'live' | 'none'
}> {
  const cached = await getGitHubStatsForDisplay()
  if (cached) {
    const updatedAt = await getGitHubStatsSnapshotUpdatedAt()
    const { needsRefresh } = await snapshotNeedsLiveRefresh(cached, updatedAt)

    if (needsRefresh) {
      try {
        const { stats: refreshed, usedSnapshotFallback } = await refreshGitHubStatsSnapshot()
        // #region agent log
        fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'grades-fix',hypothesisId:'A',location:'githubStatsSnapshot.ts:loadForPage',message:'page refresh result',data:{usedSnapshotFallback,source:usedSnapshotFallback?'snapshot':'live',totalCommits30d:refreshed.totalCommits30d,trackable:refreshed.trackableRepos?.length??0},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return {
          stats: refreshed,
          source: usedSnapshotFallback ? 'snapshot' : 'live',
        }
      } catch (err) {
        console.error('[github-snapshot] page refresh failed, using cached snapshot', err)
        scheduleStaleSnapshotRefresh()
      }
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
