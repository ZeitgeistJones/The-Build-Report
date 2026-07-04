import { commitsSinceScoreLabel as labelFromTimestamps, hasCommitAfterScore } from './commitsSinceScore'
import { isLaunchBaseline } from './scoringCopy'
import { SCORING_CONTEXT_VERSION } from './scoringContext'
import type { Repo } from './scores'

export interface RepoActivitySnapshot {
  scoredAt: string | null
  lastCommitAt: string | null
  pushedAt: string | null
  commits7d: number | null
  commits30d: number | null
  commitTimestamps?: string[] | null
  adminNote?: string | null
  scoringContextVersion?: number
}

export function hasNewCommitsSinceScore(repo: RepoActivitySnapshot): boolean {
  return hasCommitAfterScore(repo.scoredAt, repo.lastCommitAt, repo.pushedAt)
}

export function hasScoringContextUpdate(repo: Pick<Repo, 'scoringContextVersion'>): boolean {
  const v = repo.scoringContextVersion ?? 0
  return v < SCORING_CONTEXT_VERSION
}

/** True when a paid rescore is unlikely to reflect new repo or context data. */
export function shouldConfirmRescore(repo: RepoActivitySnapshot): boolean {
  if (!repo.scoredAt) return false
  if ((repo.adminNote ?? '').startsWith('Unscored — visible because')) return false
  if (isLaunchBaseline(repo.adminNote)) return false
  if (hasNewCommitsSinceScore(repo)) return false
  if (hasScoringContextUpdate(repo)) return false
  return true
}

export function commitsSinceScoreLabel(repo: RepoActivitySnapshot): string {
  return labelFromTimestamps(
    repo.scoredAt,
    repo.commitTimestamps,
    { lastCommitAt: repo.lastCommitAt, pushedAt: repo.pushedAt },
  )
}
