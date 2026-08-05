import { getLockedTag } from './criticalPath'
import { ensureSourceNormieClips } from './rubricSourceNormie'
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
  // Clip missing Plain English source notes on every read so PE mode never shows empty.
  return ensureSourceNormieClips(applyV3RepoRules(normalizeRepoScores(repo)))
}
