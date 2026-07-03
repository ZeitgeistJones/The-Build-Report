import { Repo, Tag } from './scores'
import { GitHubRepo } from './github'

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
    tokenMechanic: null,
    builderIntegrity: {
      letter: '—',
      pct: 0,
      rubric: [],
    },
    verdict: 'This repo was recently pushed on GitHub but has not received a launch baseline or live AI score yet.',
    scoredAt,
    adminNote: 'Unscored — visible because it was recently pushed on GitHub.',
  }
}

export function isUnscoredRecent(repo: Repo): boolean {
  return (repo.adminNote ?? '').startsWith('Unscored — visible because')
}
