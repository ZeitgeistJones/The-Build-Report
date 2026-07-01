import { Repo, Tag } from './scores'
import { GitHubRepo } from './github'
import { shouldSkipRepo } from './repoFilters'

const GITHUB_TOP_K = 15

export function makeUnscoredRecentRepo(gh: GitHubRepo): Repo {
  const scoredAt = new Date(gh.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return {
    id: gh.name,
    name: gh.name,
    githubSlug: gh.name,
    tag: 'theoretical' as Tag,
    status: 'active',
    confidence: 'low',
    holderRelevance: null,
    builderIntegrity: {
      letter: '—',
      pct: 0,
      rubric: [],
    },
    verdict: 'This repo was recently pushed on GitHub but has not been hand-scored or auto-inferred yet.',
    scoredAt,
    adminNote: 'Unscored — visible because it was recently pushed on GitHub.',
  }
}

/** Include unscored repos that appear in GitHub's top-K by pushed_at (matches github.com order). */
export function githubTopUnscoredRepos(githubRepos: GitHubRepo[], listedSlugs: Set<string>): Repo[] {
  const recent: Repo[] = []
  for (const gh of githubRepos.slice(0, GITHUB_TOP_K)) {
    if (listedSlugs.has(gh.name)) continue
    if (shouldSkipRepo(gh.name)) continue
    recent.push(makeUnscoredRecentRepo(gh))
    listedSlugs.add(gh.name)
  }
  return recent
}

export function isUnscoredRecent(repo: Repo): boolean {
  return (repo.adminNote ?? '').startsWith('Unscored — visible because')
}
