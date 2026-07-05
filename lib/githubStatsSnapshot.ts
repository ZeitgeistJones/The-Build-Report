import { getRedis } from '@/lib/redis'
import type { GitHubStats } from '@/lib/github'
import { getGitHubStats } from '@/lib/github'

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

/** Write path — call after getGitHubStats({ fresh: true }) in cron/admin/live fallback. */
export async function syncGitHubStatsSnapshot(stats: GitHubStats): Promise<string> {
  const updatedAt = new Date().toISOString()
  const r = getRedis()
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

/** Snapshot first; on miss fetch live GitHub once and persist for subsequent visits. */
export async function loadGitHubStatsForPage(): Promise<{
  stats: GitHubStats | null
  source: 'snapshot' | 'live' | 'none'
}> {
  const cached = await getGitHubStatsForDisplay()
  if (cached) return { stats: cached, source: 'snapshot' }

  try {
    const live = await getGitHubStats()
    try {
      await syncGitHubStatsSnapshot(live)
    } catch (err) {
      console.error('[github-snapshot] sync after live fetch failed', err)
    }
    return { stats: live, source: 'live' }
  } catch (err) {
    console.error('[github-snapshot] live fetch failed', err)
    return { stats: null, source: 'none' }
  }
}
