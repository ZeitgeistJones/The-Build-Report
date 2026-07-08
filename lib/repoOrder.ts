import { Repo, normalizeRepoScores } from './scores'
import { GitHubRepo } from './github'
import { shouldSkipRepo } from './repoFilters'
import { isUnscoredRecent } from './recentRepos'
import { normalizeAndApplyV3 } from './repoV3'

function overlayCachedOnBaseline(baseline: Repo | undefined, cached: Repo): Repo {
  const normalized = normalizeAndApplyV3(cached)
  if (!baseline) return normalized
  // Cache wins on scores, but fall back to the hand-written baseline for display-copy
  // fields the cache predates (e.g. normieVerdict, added to the autoscore prompt later).
  // Without this, actively-rescored repos silently lose their baseline normie copy.
  return {
    ...normalized,
    id: baseline.id,
    normieVerdict: normalized.normieVerdict ?? baseline.normieVerdict,
  }
}

/** Merge repo sources; Redis autoscore/rescore cache wins over launch baseline for the same slug. */
export function mergeRepoSources(handScored: Repo[], autoScored: Repo[], recentUnscored: Repo[] = []): Repo[] {
  const bySlug = new Map<string, Repo>()
  const baselineBySlug = new Map<string, Repo>()

  for (const repo of handScored) {
    if (!shouldSkipRepo(repo.githubSlug)) {
      baselineBySlug.set(repo.githubSlug, normalizeAndApplyV3(repo))
    }
  }

  for (const repo of recentUnscored) {
    if (!shouldSkipRepo(repo.githubSlug)) bySlug.set(repo.githubSlug, repo)
  }
  for (const repo of handScored) {
    if (!shouldSkipRepo(repo.githubSlug)) bySlug.set(repo.githubSlug, normalizeAndApplyV3(repo))
  }
  for (const repo of autoScored) {
    if (!shouldSkipRepo(repo.githubSlug)) {
      bySlug.set(repo.githubSlug, overlayCachedOnBaseline(baselineBySlug.get(repo.githubSlug), repo))
    }
  }
  return Array.from(bySlug.values())
}

function scoredBySlug(handScored: Repo[], autoScored: Repo[]): Map<string, Repo> {
  const bySlug = new Map<string, Repo>()
  const baselineBySlug = new Map<string, Repo>()

  for (const repo of handScored) {
    if (!shouldSkipRepo(repo.githubSlug)) {
      baselineBySlug.set(repo.githubSlug, normalizeAndApplyV3(repo))
    }
  }

  for (const repo of handScored) {
    if (!shouldSkipRepo(repo.githubSlug)) bySlug.set(repo.githubSlug, normalizeAndApplyV3(repo))
  }
  for (const repo of autoScored) {
    if (!shouldSkipRepo(repo.githubSlug)) {
      bySlug.set(repo.githubSlug, overlayCachedOnBaseline(baselineBySlug.get(repo.githubSlug), repo))
    }
  }
  return bySlug
}

/**
 * Walk GitHub's trackable repo list in pushed_at order and emit one card per repo.
 * Uses hand-scored / autoscore cache when available; otherwise an unscored placeholder.
 * Matches https://github.com/clawdbotatg?tab=repositories without skipping rows.
 */
export function buildReposInGithubOrder(
  githubOrder: GitHubRepo[],
  handScored: Repo[],
  autoScored: Repo[],
  makeUnscored: (gh: GitHubRepo) => Repo,
): Repo[] {
  const scored = scoredBySlug(handScored, autoScored)
  const ordered: Repo[] = []
  const includedIds = new Set<string>()

  for (const gh of githubOrder) {
    if (shouldSkipRepo(gh.name)) continue

    const entry = scored.get(gh.name) ?? makeUnscored(gh)
    ordered.push(entry)
    includedIds.add(entry.id)
  }

  // Hand-scored entries with a unique id not yet shown (e.g. duplicate githubSlug rows)
  for (const repo of handScored) {
    if (shouldSkipRepo(repo.githubSlug)) continue
    if (includedIds.has(repo.id)) continue
    ordered.push(isUnscoredRecent(repo) ? repo : normalizeAndApplyV3(repo))
    includedIds.add(repo.id)
  }

  return ordered
}

export function githubSlugOrder(githubOrder: GitHubRepo[]): string[] {
  return githubOrder.map(r => r.name)
}

export function cacheLookupSlugs(
  handScored: Repo[],
  trackableGithub: GitHubRepo[],
  excludedSlugs: Set<string>,
): string[] {
  const slugs = new Set<string>()
  for (const gh of trackableGithub) {
    if (!shouldSkipRepo(gh.name) && !excludedSlugs.has(gh.name)) slugs.add(gh.name)
  }
  for (const repo of handScored) {
    if (!shouldSkipRepo(repo.githubSlug) && !excludedSlugs.has(repo.githubSlug)) {
      slugs.add(repo.githubSlug)
    }
  }
  return Array.from(slugs)
}
