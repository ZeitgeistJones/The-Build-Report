/**
 * Overnight full-rescore of repos that had Mountain-day commits.
 * Chunked + Redis-checkpointed so Gemini quota / 300s limits don't strand the day.
 *
 * Also merges the most overdue “behind score” repos so a high-activity desk
 * (e.g. instant-wallet with weeks of commits) cannot stay stuck on an old
 * Rescored date while the brief talks about last night’s work.
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
import { listBehindRescoreSlugs } from '@/lib/staleRescoreBatch'

const QUEUE_KEY_PREFIX = 'build-report:overnight-rescore:queue:'
const DONE_KEY_PREFIX = 'build-report:overnight-rescore:done:'
const TTL_SEC = 3 * 24 * 3600

/** Keep batches small — each rescore is a heavy Gemini call. */
const DEFAULT_BATCH_SIZE = 3

/** Cap how many overdue-but-quiet-today repos we inject ahead of the day queue. */
const MAX_BEHIND_INJECT = 12

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

/**
 * Build / refresh the day's queue.
 * Never freeze an early thin snapshot — merge new activity and overdue
 * behind-score repos on every tick so stranded cards keep moving forward.
 */
async function ensureQueue(
  dateKey: string,
  activity: RepoBuildActivity[],
  stats: GitHubStats,
): Promise<string[]> {
  const redis = getRedis()
  const existingRaw = await redis.get<string[]>(queueKey(dateKey))
  const existing = Array.isArray(existingRaw) ? existingRaw : []

  const { startMs, endMs } = mountainDateKeyBoundsMs(dateKey)
  const already = new Set(await getSlugsRescoredBetween(startMs, endMs))
  const done = new Set((await redis.get<string[]>(doneKey(dateKey))) ?? [])

  const activityCommits = new Map(activity.map(a => [a.slug, a.commits.length]))
  const behind = await listBehindRescoreSlugs(stats).catch(err => {
    console.warn('[overnight-rescore] behind list failed; continuing with day activity', err)
    return [] as string[]
  })
  const behindRank = new Map(behind.map((slug, i) => [slug, i]))

  const candidates = new Set<string>()
  for (const slug of behind.slice(0, MAX_BEHIND_INJECT)) candidates.add(slug)
  for (const row of activity) candidates.add(row.slug)
  for (const slug of existing) candidates.add(slug)

  const queue = Array.from(candidates)
    .filter(slug => !shouldSkipRepo(slug) && !already.has(slug) && !done.has(slug))
    .sort((a, b) => {
      const ca = activityCommits.get(a) ?? 0
      const cb = activityCommits.get(b) ?? 0
      if (cb !== ca) return cb - ca
      const ra = behindRank.get(a) ?? Number.MAX_SAFE_INTEGER
      const rb = behindRank.get(b) ?? Number.MAX_SAFE_INTEGER
      if (ra !== rb) return ra - rb
      return a.localeCompare(b)
    })

  await redis.set(queueKey(dateKey), queue, { ex: TTL_SEC })
  return queue
}

/**
 * Score up to `batchSize` active / overdue repos for the Mountain edition day.
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
  let queue = await ensureQueue(dateKey, activity, options.stats)

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
    queued: queue.length + scored.length,
    attempted: batch.length,
    scored,
    failed,
    remaining: queue.length,
    needleRepoCount,
  }
}
