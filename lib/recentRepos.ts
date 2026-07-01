import { Repo, Tag } from './scores'
import { GitHubRepo } from './github'
import { shouldSkipRepo } from './repoFilters'

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

/** Placeholder for the most recent GitHub repo with no hand-score or autoscore cache yet. */
export function githubTopUnscoredRepos(githubRepos: GitHubRepo[], listedSlugs: Set<string>): Repo[] {
  for (const gh of githubRepos) {
    if (listedSlugs.has(gh.name)) continue
    if (shouldSkipRepo(gh.name)) continue
    return [makeUnscoredRecentRepo(gh)]
  }
  return []
}

export function isUnscoredRecent(repo: Repo): boolean {
  return (repo.adminNote ?? '').startsWith('Unscored — visible because')
}
