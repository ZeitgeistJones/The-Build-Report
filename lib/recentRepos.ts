import { Repo, Tag } from './scores'
import { GitHubRepo } from './github'

const RECENT_UNSCORED_DAYS = 30
const RECENT_UNSCORED_LIMIT = 30

function daysAgo(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 86400000
}

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

export function recentUnscoredRepos(githubRepos: GitHubRepo[], listedSlugs: Set<string>): Repo[] {
  const sorted = [...githubRepos].sort(
    (a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime(),
  )

  const recent: Repo[] = []
  for (const gh of sorted) {
    if (recent.length >= RECENT_UNSCORED_LIMIT) break
    if (listedSlugs.has(gh.name)) continue
    if (daysAgo(gh.pushedAt) > RECENT_UNSCORED_DAYS) continue
    recent.push(makeUnscoredRecentRepo(gh))
    listedSlugs.add(gh.name)
  }
  return recent
}

export function isUnscoredRecent(repo: Repo): boolean {
  return (repo.adminNote ?? '').startsWith('Unscored — visible because')
}
