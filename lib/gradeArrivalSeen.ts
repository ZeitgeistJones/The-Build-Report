import { getRedis } from '@/lib/redis'

export type GradeArrivalCategory = 'holder-econ' | 'integrity'

const SEEN_KEY: Record<GradeArrivalCategory, string> = {
  'holder-econ': 'grade:seen-arrival:holder-econ',
  integrity: 'grade:seen-arrival:integrity',
}

const BOOTSTRAP_KEY: Record<GradeArrivalCategory, string> = {
  'holder-econ': 'grade:arrival-bootstrap:holder-econ:v1',
  integrity: 'grade:arrival-bootstrap:integrity:v1',
}

async function readSeenSet(category: GradeArrivalCategory): Promise<Set<string>> {
  try {
    const r = getRedis()
    const members = await r.smembers(SEEN_KEY[category])
    return new Set(Array.isArray(members) ? (members as string[]) : [])
  } catch {
    return new Set()
  }
}

/** Slugs already welcomed in this grade category (lifetime). */
export async function getSeenArrivals(category: GradeArrivalCategory): Promise<Set<string>> {
  return readSeenSet(category)
}

/**
 * One-time forward-looking bootstrap: mark every repo already in the sample as seen
 * so the tray only lists future first-timers.
 */
export async function ensureArrivalBootstrap(
  category: GradeArrivalCategory,
  sampleSlugs: string[],
): Promise<void> {
  if (!sampleSlugs.length) return
  try {
    const r = getRedis()
    const done = await r.get<string>(BOOTSTRAP_KEY[category])
    if (done) return
    if (sampleSlugs.length) {
      await Promise.all(sampleSlugs.map(slug => r.sadd(SEEN_KEY[category], slug)))
    }
    await r.set(BOOTSTRAP_KEY[category], '1')
  } catch {
    // non-blocking — arrivals still work without persistence
  }
}

/** Record first-time appearances so they never list again in this category. */
export async function markArrivalsSeen(
  category: GradeArrivalCategory,
  slugs: string[],
): Promise<void> {
  if (!slugs.length) return
  try {
    const r = getRedis()
    await Promise.all(slugs.map(slug => r.sadd(SEEN_KEY[category], slug)))
  } catch {
    // non-blocking
  }
}
