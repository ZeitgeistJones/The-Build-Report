import { Repo } from './scores'
import { GitHubRepo } from './github'
import { shouldSkipRepo } from './repoFilters'

/** Merge repo sources; hand-scored REPOS entries win over auto-scored duplicates. */
export function mergeRepoSources(handScored: Repo[], autoScored: Repo[], recentUnscored: Repo[] = []): Repo[] {
  const bySlug = new Map<string, Repo>()
  for (const repo of recentUnscored) {
    if (!shouldSkipRepo(repo.githubSlug)) bySlug.set(repo.githubSlug, repo)
  }
  for (const repo of autoScored) {
    if (!shouldSkipRepo(repo.githubSlug)) bySlug.set(repo.githubSlug, repo)
  }
  for (const repo of handScored) {
    if (!shouldSkipRepo(repo.githubSlug)) bySlug.set(repo.githubSlug, repo)
  }
  return Array.from(bySlug.values())
}

function scoredBySlug(handScored: Repo[], autoScored: Repo[]): Map<string, Repo> {
  const bySlug = new Map<string, Repo>()
  for (const repo of autoScored) {
    if (!shouldSkipRepo(repo.githubSlug)) bySlug.set(repo.githubSlug, repo)
  }
  for (const repo of handScored) {
    if (!shouldSkipRepo(repo.githubSlug)) bySlug.set(repo.githubSlug, repo)
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
    ordered.push(repo)
    includedIds.add(repo.id)
  }

  return ordered
}

export function githubSlugOrder(githubOrder: GitHubRepo[]): string[] {
  return githubOrder.map(r => r.name)
}
