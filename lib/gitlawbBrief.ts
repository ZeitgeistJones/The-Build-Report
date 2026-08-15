/**
 * Back-compat wrappers for gitlawb / $GITLAWB — implementation lives in
 * lib/externalOwnerBrief.ts so multiple secondary accounts share one pipeline.
 */

import {
  generateAndCacheExternalDigest,
  getExternalBrief,
  type ExternalDigestCache,
} from '@/lib/externalOwnerBrief'
import { yesterdayMountainDateKey, type BuildBriefData } from '@/lib/buildBrief'

export type GitlawbDigestCache = ExternalDigestCache

export async function generateAndCacheGitlawbDigest(options?: {
  force?: boolean
  dateKey?: string
}): Promise<GitlawbDigestCache> {
  return generateAndCacheExternalDigest('gitlawb', options)
}

export async function getGitlawbBrief(
  dateKey = yesterdayMountainDateKey(),
): Promise<BuildBriefData | null> {
  return getExternalBrief('gitlawb', dateKey)
}

export async function getOrGenerateGitlawbBrief(options?: {
  force?: boolean
  dateKey?: string
}): Promise<BuildBriefData> {
  const digest = await generateAndCacheGitlawbDigest(options)
  return {
    text: digest.general,
    general: digest.general,
    ...(digest.generalNormie ? { generalNormie: digest.generalNormie } : {}),
    cards: null,
    dateKey: digest.dateKey,
    isToday: false,
    repoCount: digest.repoCount,
    commitCount: digest.commitCount,
    generatedAt: digest.generatedAt,
  }
}
