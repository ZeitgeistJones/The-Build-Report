import { getRedis } from '@/lib/redis'

/** Keep Brief + Needle editions for Archives (~90 days). */
export const ARCHIVE_TTL_SEC = 90 * 24 * 3600

export const BRIEF_DATES_INDEX_KEY = 'build-report:archive:brief-dates'
export const NEEDLE_DATES_INDEX_KEY = 'build-report:archive:needle-dates'

const EASTERN_TZ = 'America/New_York'

function dateKeyEastern(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: EASTERN_TZ }).format(d)
}

/** YYYY-MM-DD → sortable integer score (e.g. 20260709). */
export function dateKeyToScore(dateKey: string): number {
  const n = Number(dateKey.replace(/-/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function scoreToDateKey(score: number): string {
  const s = String(Math.trunc(score))
  if (s.length !== 8) return s
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

/** Eastern calendar dateKey for `days` ago from `now`. */
export function easternDateKeyDaysAgo(days: number, now = new Date()): string {
  const today = dateKeyEastern(now)
  const [y, m, d] = today.split('-').map(Number)
  if (!y || !m || !d) return today
  const prior = new Date(Date.UTC(y, m - 1, d))
  prior.setUTCDate(prior.getUTCDate() - days)
  return prior.toISOString().slice(0, 10)
}

/** Record an edition date in the archive index and prune members older than 90d. */
export async function indexArchiveDate(
  indexKey: string,
  dateKey: string,
): Promise<void> {
  try {
    const r = getRedis()
    const score = dateKeyToScore(dateKey)
    if (!score) return
    const cutoff = dateKeyToScore(easternDateKeyDaysAgo(90))
    await Promise.all([
      r.zadd(indexKey, { score, member: dateKey }),
      cutoff > 0 ? r.zremrangebyscore(indexKey, 0, cutoff - 1) : Promise.resolve(0),
    ])
  } catch {
    // non-fatal — edition payload is still cached
  }
}

/** Newest-first dateKeys in [sinceDateKey, ∞] from a ZSET index. */
export async function listIndexedDateKeys(
  indexKey: string,
  sinceDateKey: string,
): Promise<string[]> {
  try {
    const r = getRedis()
    const min = dateKeyToScore(sinceDateKey)
    const max = 99_999_999
    const members = await r.zrange(indexKey, min, max, { byScore: true, rev: true })
    if (!Array.isArray(members)) return []
    return members.map(m => String(m)).filter(Boolean)
  } catch {
    return []
  }
}
