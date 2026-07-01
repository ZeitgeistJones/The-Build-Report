import { Repo } from './scores'
import { GitHubRepo } from './github'
import { shouldSkipRepo } from './repoFilters'

/** Merge repo sources; hand-scored REPOS entries win over auto-scored duplicates. */
export function mergeRepoSources(handScored: Repo[], autoScored: Repo[], recentUnscored: Repo[]): Repo[] {
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

/** Sort repos to match GitHub's pushed_at order (same as github.com/.../repositories). */
export function orderReposByGithub<T extends { githubSlug: string }>(
  repos: T[],
  githubOrder: GitHubRepo[],
): T[] {
  const bySlug = new Map(repos.map(r => [r.githubSlug, r]))
  const ordered: T[] = []
  const seen = new Set<string>()

  for (const gh of githubOrder) {
    const repo = bySlug.get(gh.name)
    if (!repo) continue
    ordered.push(repo)
    seen.add(gh.name)
  }

  for (const repo of repos) {
    if (!seen.has(repo.githubSlug)) ordered.push(repo)
  }

  return ordered
}

export function githubSlugOrder(githubOrder: GitHubRepo[]): string[] {
  return githubOrder.map(r => r.name)
}
