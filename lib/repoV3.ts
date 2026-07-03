import { getLockedTag } from './criticalPath'
import { normalizeRepoScores, type Repo } from './scores'

/** Apply v3 display rules: locked critical-path tags. Score floors applied at read time in economicGrade. */
export function applyV3RepoRules(repo: Repo): Repo {
  const lockedTag = getLockedTag(repo.githubSlug)
  if (!lockedTag || lockedTag === repo.tag) {
    return repo
  }
  return { ...repo, tag: lockedTag }
}

export function normalizeAndApplyV3(repo: Repo): Repo {
  return applyV3RepoRules(normalizeRepoScores(repo))
}
