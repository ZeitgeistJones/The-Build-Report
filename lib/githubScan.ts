import { getRedis } from '@/lib/redis'

const SCAN_AT_KEY = 'build-report:github-scan-at'

export async function setLastGithubScanAt(iso: string): Promise<void> {
  const r = getRedis()
  await r.set(SCAN_AT_KEY, iso)
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
