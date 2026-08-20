/**
 * Overnight full-rescore of repos that had Mountain-day commits.
 * Chunked + Redis-checkpointed so Gemini quota / 300s limits don't strand the day.
 */

import {
  collectBuildActivityForMountainDay,
  loadReposForBrief,
  mountainDateKeyBoundsMs,
  yesterdayMountainDateKey,
  type RepoBuildActivity,
} from '@/lib/buildBrief'
import { getRedis } from '@/lib/redis'
import { runRescorePipeline } from '@/lib/rescorePipeline'
import { getSlugsRescoredBetween } from '@/lib/scoreHistory'
import { generateAndCacheNeedle } from '@/lib/needle'
import type { GitHubStats } from '@/lib/github'
import { shouldSkipRepo } from '@/lib/repoFilters'

const QUEUE_KEY_PREFIX = 'build-report:overnight-rescore:queue:'
const DONE_KEY_PREFIX = 'build-report:overnight-rescore:done:'
const TTL_SEC = 3 * 24 * 3600

/** Keep batches small — each rescore is a heavy Gemini call. */
const DEFAULT_BATCH_SIZE = 3

export type OvernightRescoreResult = {
  dateKey: string
  queued: number
  attempted: number
  scored: string[]
  failed: Array<{ slug: string; error: string }>
  remaining: number
  needleRepoCount: number | null
}

function queueKey(dateKey: string): string {
  return `${QUEUE_KEY_PREFIX}${dateKey}`
}

function doneKey(dateKey: string): string {
  return `${DONE_KEY_PREFIX}${dateKey}`
}

async function ensureQueue(
  dateKey: string,
  activity: RepoBuildActivity[],
): Promise<string[]> {
  const redis = getRedis()
  const existing = await redis.get<string[]>(queueKey(dateKey))
  if (Array.isArray(existing) && existing.length > 0) return existing

  const { startMs, endMs } = mountainDateKeyBoundsMs(dateKey)
  const already = new Set(await getSlugsRescoredBetween(startMs, endMs))
  const done = new Set((await redis.get<string[]>(doneKey(dateKey))) ?? [])

  const queue = activity
    .map(a => a.slug)
    .filter(slug => !shouldSkipRepo(slug) && !already.has(slug) && !done.has(slug))

  await redis.set(queueKey(dateKey), queue, { ex: TTL_SEC })
  return queue
}

/**
 * Score up to `batchSize` active repos for the Mountain edition day.
 * Safe to call from daily-digest and warm-cache — resumes unfinished queues.
 */
export async function runOvernightActiveRescores(options: {
  stats: GitHubStats
  dateKey?: string
  batchSize?: number
  /** When true, regenerate Needle even if nothing scored this tick. */
  refreshNeedle?: boolean
}): Promise<OvernightRescoreResult> {
  const dateKey = options.dateKey ?? yesterdayMountainDateKey()
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  const redis = getRedis()

  const repos = await loadReposForBrief(options.stats)
  const activity = collectBuildActivityForMountainDay(options.stats, repos, dateKey)
  let queue = await ensureQueue(dateKey, activity)

  const batch = queue.slice(0, batchSize)
  const scored: string[] = []
  const failed: Array<{ slug: string; error: string }> = []
  const scoredSet = new Set<string>()

  for (const slug of batch) {
    try {
      await runRescorePipeline(slug)
      scored.push(slug)
      scoredSet.add(slug)
      const done = new Set((await redis.get<string[]>(doneKey(dateKey))) ?? [])
      done.add(slug)
      await redis.set(doneKey(dateKey), Array.from(done), { ex: TTL_SEC })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'rescore failed'
      console.error(`[overnight-rescore] ${slug} failed:`, err)
      failed.push({ slug, error: message })
    }
  }

  // Drop scored; rotate failures to the end for a later retry.
  const failedSlugs = failed.map(f => f.slug)
  queue = [
    ...queue.filter(s => !scoredSet.has(s) && !failedSlugs.includes(s)),
    ...failedSlugs,
  ]
  await redis.set(queueKey(dateKey), queue, { ex: TTL_SEC })

  let needleRepoCount: number | null = null
  if (scored.length > 0 || options.refreshNeedle) {
    try {
      const needle = await generateAndCacheNeedle({
        dateKey,
        force: true,
        activity,
      })
      needleRepoCount = needle?.repoCount ?? 0
    } catch (err) {
      console.error('[overnight-rescore] needle refresh failed:', err)
    }
  }

  return {
    dateKey,
    queued: activity.length,
    attempted: batch.length,
    scored,
    failed,
    remaining: queue.length,
    needleRepoCount,
  }
}
