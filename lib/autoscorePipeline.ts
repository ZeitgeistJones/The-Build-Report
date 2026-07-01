import { getGitHubStats, GitHubRepo } from './github'
import { REPOS } from './scores'
import { shouldSkipRepo } from './repoFilters'
import { runAutoScores, RawRepo } from './autoscore'

export function toRawRepo(gh: GitHubRepo): RawRepo {
  return {
    name: gh.name,
    description: gh.description,
    pushedAt: gh.pushedAt,
    createdAt: gh.createdAt,
    language: gh.language,
  }
}

export function listUnscoredTrackable(
  trackable: GitHubRepo[],
  knownSlugs: Set<string>,
): RawRepo[] {
  return trackable
    .filter(repo => !knownSlugs.has(repo.name) && !shouldSkipRepo(repo.name))
    .map(toRawRepo)
}

export async function runAutoscorePipeline() {
  const stats = await getGitHubStats()
  const trackable = stats?.trackableRepos ?? []
  const knownRepoSlugs = new Set(REPOS.map(r => r.githubSlug))
  const unscoredRepos = listUnscoredTrackable(trackable, knownRepoSlugs)
  const githubOrder = trackable.map(r => r.name)

  const { repos, inferred, deferred } = await runAutoScores(unscoredRepos, { githubOrder })

  return {
    found: unscoredRepos.length,
    scoredReturned: repos.length,
    inferred,
    deferred,
    names: repos.map(r => r.name),
  }
}
