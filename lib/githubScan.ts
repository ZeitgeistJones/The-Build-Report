import { Redis } from '@upstash/redis'

const SCAN_AT_KEY = 'build-report:github-scan-at'

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

export function formatScanAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
