import { getCachedScore, listCachedAutoScores, writeCachedScore } from '@/lib/autoscore'
import { attachRubricSourceNormies } from '@/lib/rubricSourceNormie'

export const SOURCE_NORMIE_BACKFILL_DEFAULT_BATCH = 8
export const SOURCE_NORMIE_BACKFILL_MAX_BATCH = 15

export interface SourceNormieBackfillResult {
  rewritten: string[]
  failed: string[]
  totalCached: number
  processedOffset: number
  nextOffset: number | null
}

/**
 * Rewrite Plain English rubric notes for cached scores — no grade re-inference.
 * Defaults to stale/missing notes only (cheaper); pass forceAll to rewrite every row.
 */
export async function runSourceNormieBackfillBatch(options: {
  offset?: number
  limit?: number
  forceAll?: boolean
}): Promise<SourceNormieBackfillResult> {
  const slugs = (await listCachedAutoScores()).slice().sort((a, b) => a.localeCompare(b))
  const offset = Math.max(0, options.offset ?? 0)
  const limit = Math.min(
    Math.max(1, options.limit ?? SOURCE_NORMIE_BACKFILL_DEFAULT_BATCH),
    SOURCE_NORMIE_BACKFILL_MAX_BATCH,
  )
  const batch = slugs.slice(offset, offset + limit)
  const onlyStale = options.forceAll !== true

  const rewritten: string[] = []
  const failed: string[] = []

  for (const slug of batch) {
    try {
      const cached = await getCachedScore(slug)
      if (!cached) {
        failed.push(slug)
        continue
      }
      const updated = await attachRubricSourceNormies(cached, { onlyStale })
      await writeCachedScore(updated)
      rewritten.push(slug)
    } catch (err) {
      console.error('[source-normie-backfill] failed', slug, err)
      failed.push(slug)
    }
  }

  const next = offset + batch.length
  return {
    rewritten,
    failed,
    totalCached: slugs.length,
    processedOffset: offset + batch.length,
    nextOffset: next < slugs.length ? next : null,
  }
}
