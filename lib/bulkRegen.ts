import { getGitHubStats } from './github'
import { REPOS, Repo } from './scores'
import { shouldSkipRepo } from './repoFilters'
import { getExcludedSlugs } from './repoExclude'
import { formatAcceptedCommunityContext } from './communityContext'
import {
  flushLegacyAutoScore,
  getCachedScore,
  inferAndCacheRepo,
  listCachedAutoScores,
  RawRepo,
  toRawRepo,
} from './autoscore'
import { BULK_REGEN_DEFAULT_BATCH, BULK_REGEN_MAX_BATCH } from './bulkRegenConfig'

export interface BaselineBackup {
  version: 'scoring-v3-baseline'
  exportedAt: string
  handScoredRepos: Repo[]
  cachedAutoScoreSlugs: string[]
}

export function exportBaselineBackup(cachedSlugs: string[]): BaselineBackup {
  return {
    version: 'scoring-v3-baseline',
    exportedAt: new Date().toISOString(),
    handScoredRepos: REPOS,
    cachedAutoScoreSlugs: cachedSlugs,
  }
}

export interface BulkRegenBatchResult {
  scored: string[]
  failed: string[]
  skipped: string[]
  totalEligible: number
  processedOffset: number
  nextOffset: number | null
}

export async function listBulkRegenTargets(): Promise<{ slugs: string[]; rawRepos: RawRepo[] }> {
  const stats = await getGitHubStats()
  const excludedMap = await getExcludedSlugs()
  const excludedSlugs = new Set(Object.keys(excludedMap).filter(k => excludedMap[k]))

  const rawRepos = stats.trackableRepos
    .filter(repo => !shouldSkipRepo(repo.name) && !excludedSlugs.has(repo.name))
    .map(toRawRepo)
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    slugs: rawRepos.map(r => r.name),
    rawRepos,
  }
}

export async function runBulkRegenerateBatch(options: {
  flushFirst: boolean
  offset?: number
  limit?: number
  overwritePaid?: boolean
}): Promise<BulkRegenBatchResult> {
  const { slugs, rawRepos } = await listBulkRegenTargets()
  const offset = Math.max(0, options.offset ?? 0)
  const limit = Math.min(Math.max(1, options.limit ?? BULK_REGEN_DEFAULT_BATCH), BULK_REGEN_MAX_BATCH)
  const batch = rawRepos.slice(offset, offset + limit)

  const scored: string[] = []
  const failed: string[] = []
  const skipped: string[] = []

  for (const raw of batch) {
    const cached = await getCachedScore(raw.name)
    if (cached?.scoreOrigin === 'paid' && !options.overwritePaid) {
      skipped.push(raw.name)
      continue
    }

    const communityContext = await formatAcceptedCommunityContext(raw.name).catch(() => undefined)

    const repo = await inferAndCacheRepo(raw, {
      skipCache: true,
      communityContext,
      scoreOrigin: 'bulk',
    })

    if (repo) {
      scored.push(raw.name)
      if (options.flushFirst) {
        await flushLegacyAutoScore(raw.name)
      }
    } else {
      failed.push(raw.name)
    }
  }

  const nextOffset = offset + batch.length < slugs.length ? offset + batch.length : null

  return {
    scored,
    failed,
    skipped,
    totalEligible: slugs.length,
    processedOffset: offset,
    nextOffset,
  }
}

export async function getBulkRegenStatus() {
  const cached = await listCachedAutoScores()
  const { slugs } = await listBulkRegenTargets()
  return {
    trackableCount: slugs.length,
    cachedCount: cached.length,
    handScoredBaselineCount: REPOS.length,
  }
}
