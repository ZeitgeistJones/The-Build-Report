import { getRedis } from '@/lib/redis'
import type { Redis } from '@upstash/redis'

const KEY_PREFIX = 'build-report:score-history:'
const MAX_ENTRIES = 10

export type ScoreHistoryEntry = {
  scoredAt: string
  builderIntegrityLetter: string
  builderIntegrityPct: number
  economicLetter: string | null
  economicPct: number | null
  economicLabel: string | null
}

function historyKey(slug: string) {
  return `${KEY_PREFIX}${slug}`
}

export async function appendScoreHistory(
  slug: string,
  entry: ScoreHistoryEntry,
  client?: Redis,
): Promise<void> {
  const r = client ?? getRedis()
  const key = historyKey(slug)
  await r.lpush(key, entry)
  await r.ltrim(key, 0, MAX_ENTRIES - 1)
  await r.expire(key, 60 * 60 * 24 * 180) // 180 days
}

export async function getScoreHistory(slug: string): Promise<ScoreHistoryEntry[]> {
  try {
    const r = getRedis()
    const raw = await r.lrange<ScoreHistoryEntry>(historyKey(slug), 0, MAX_ENTRIES - 1)
    return raw ?? []
  } catch {
    return []
  }
}

export async function getScoreHistories(
  slugs: string[],
): Promise<Record<string, ScoreHistoryEntry[]>> {
  if (!slugs.length) return {}
  try {
    const r = getRedis()
    const results: Record<string, ScoreHistoryEntry[]> = {}
    await Promise.all(
      slugs.map(async slug => {
        const entries = await r.lrange<ScoreHistoryEntry>(historyKey(slug), 0, MAX_ENTRIES - 1)
        if (entries?.length) results[slug] = entries
      }),
    )
    return results
  } catch {
    return {}
  }
}
