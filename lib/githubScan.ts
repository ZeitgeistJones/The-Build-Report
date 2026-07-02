import { Redis } from '@upstash/redis'
import { getGitHubStats, GitHubStats } from './github'

const SCAN_AT_KEY = 'build-report:github-scan-at'
const STATS_KEY = 'build-report:github-stats'

let redis: Redis | null = null

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
}

export async function getLastGithubScanAt(): Promise<string | null> {
  try {
    const r = getRedis()
    return await r.get<string>(SCAN_AT_KEY)
  } catch {
    return null
  }
}

export async function getCachedGitHubStats(): Promise<GitHubStats | null> {
  try {
    const r = getRedis()
    return await r.get<GitHubStats>(STATS_KEY)
  } catch {
    return null
  }
}

export async function runGithubScanAndCache(): Promise<{ stats: GitHubStats; scannedAt: string }> {
  const stats = await getGitHubStats({ fresh: true })
  const scannedAt = new Date().toISOString()
  const r = getRedis()
  await r.set(STATS_KEY, stats)
  await r.set(SCAN_AT_KEY, scannedAt)
  return { stats, scannedAt }
}

export function formatScanAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
