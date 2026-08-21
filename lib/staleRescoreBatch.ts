/**
 * Admin batch: rescore scored repos with new commits since last score
 * (homepage “Awaiting overnight” / old promo Rescore set).
 */

import { loadReposForBrief } from '@/lib/buildBrief'
import { BULK_REGEN_DEFAULT_BATCH, BULK_REGEN_MAX_BATCH } from '@/lib/bulkRegenConfig'
import { repoNeedsRescore, repoNeedsRescoreSortKey } from '@/lib/commitsSinceScore'
import { getGitHubStats, type GitHubStats } from '@/lib/github'
import { getGitHubStatsForDisplay } from '@/lib/githubStatsSnapshot'
import { isRepoExcluded } from '@/lib/repoExclude'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { runRescorePipeline } from '@/lib/rescorePipeline'

const PREVIEW_LIMIT = 20

export type BehindRescoreStatus = {
  count: number
  slugs: string[]
  preview: string[]
}

export type BehindRescoreBatchResult = {
  scored: string[]
  failed: Array<{ slug: string; error: string }>
  attempted: number
}

async function loadStats(): Promise<GitHubStats> {
  const cached = await getGitHubStatsForDisplay()
  if (cached) return cached
  return getGitHubStats()
}

/** Scored trackable repos with activity after scoredAt — most overdue first. */
export async function listBehindRescoreSlugs(
  stats?: GitHubStats,
): Promise<string[]> {
  const resolved = stats ?? (await loadStats())
  const repos = await loadReposForBrief(resolved)

  const ranked = repos
    .filter(repo => {
      const slug = repo.githubSlug
      if (!slug || shouldSkipRepo(slug) || repo.excluded) return false
      return repoNeedsRescore(repo.scoredAt, repo.commitTimestamps, {
        lastCommitAt: repo.lastCommitAt,
        pushedAt: repo.pushedAt,
      })
    })
    .map(repo => ({
      slug: repo.githubSlug,
      key: repoNeedsRescoreSortKey(repo.scoredAt, repo.commitTimestamps, {
        lastCommitAt: repo.lastCommitAt,
        pushedAt: repo.pushedAt,
      }),
    }))
    .sort((a, b) => b.key - a.key || a.slug.localeCompare(b.slug))

  return ranked.map(r => r.slug)
}

export async function getBehindRescoreStatus(): Promise<BehindRescoreStatus> {
  const slugs = await listBehindRescoreSlugs()
  return {
    count: slugs.length,
    slugs,
    preview: slugs.slice(0, PREVIEW_LIMIT),
  }
}

/**
 * Score a specific batch of slugs (caller slices from status.slugs).
 * Skips excluded / filter-skipped names inside the batch.
 */
export async function runBehindRescoreBatch(options: {
  slugs: string[]
  limit?: number
}): Promise<BehindRescoreBatchResult> {
  const limit = Math.min(
    Math.max(1, options.limit ?? BULK_REGEN_DEFAULT_BATCH),
    BULK_REGEN_MAX_BATCH,
  )
  const batch = options.slugs.slice(0, limit).filter(Boolean)

  const scored: string[] = []
  const failed: Array<{ slug: string; error: string }> = []

  for (const slug of batch) {
    if (shouldSkipRepo(slug)) {
      failed.push({ slug, error: 'Repo not eligible for scoring' })
      continue
    }
    if (await isRepoExcluded(slug)) {
      failed.push({ slug, error: 'Repo is excluded from scoring' })
      continue
    }
    try {
      await runRescorePipeline(slug)
      scored.push(slug)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'rescore failed'
      console.error(`[stale-rescore-batch] ${slug} failed:`, err)
      failed.push({ slug, error: message })
    }
  }

  return {
    scored,
    failed,
    attempted: batch.length,
  }
}
