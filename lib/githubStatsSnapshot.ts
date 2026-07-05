import { getRedis } from '@/lib/redis'
import type { GitHubStats } from '@/lib/github'

const SNAPSHOT_KEY = 'build-report:github-stats:snapshot'
const SNAPSHOT_UPDATED_AT_KEY = 'build-report:github-stats:snapshot:updatedAt'

/** Write path — call after getGitHubStats({ fresh: true }) in cron/admin. */
export async function syncGitHubStatsSnapshot(stats: GitHubStats): Promise<void> {
  const r = getRedis()
  await Promise.all([
    r.set(SNAPSHOT_KEY, stats),
    r.set(SNAPSHOT_UPDATED_AT_KEY, new Date().toISOString()),
  ])
}

/** Read path — KV only. Returns null when snapshot has never been written. */
export async function getGitHubStatsForDisplay(): Promise<GitHubStats | null> {
  try {
    const r = getRedis()
    const snapshot = await r.get<GitHubStats>(SNAPSHOT_KEY)
    if (!snapshot || typeof snapshot.totalRepos !== 'number') return null
    return snapshot
  } catch {
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
