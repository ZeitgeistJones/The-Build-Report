import { getGitHubStats } from './github'
import { GitHubRepo } from './github'
import { REPOS } from './scores'
import { shouldSkipRepo } from './repoFilters'
import { getExcludedSlugs } from './repoExclude'
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
  excludedSlugs: Set<string> = new Set(),
): RawRepo[] {
  return trackable
    .filter(repo => !knownSlugs.has(repo.name) && !shouldSkipRepo(repo.name) && !excludedSlugs.has(repo.name))
    .map(toRawRepo)
}

export async function runAutoscorePipeline() {
  const stats = await getGitHubStats()
  const trackable = stats.trackableRepos
  const knownRepoSlugs = new Set(REPOS.map(r => r.githubSlug))
  const excludedMap = await getExcludedSlugs()
  const excludedSlugs = new Set(Object.keys(excludedMap).filter(k => excludedMap[k]))
  const unscoredRepos = listUnscoredTrackable(trackable, knownRepoSlugs, excludedSlugs)
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
