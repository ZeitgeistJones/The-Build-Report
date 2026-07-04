import { isLaunchBaseline } from './scoringCopy'
import { SCORING_CONTEXT_VERSION } from './scoringContext'
import type { Repo } from './scores'

export interface RepoActivitySnapshot {
  scoredAt: string | null
  lastCommitAt: string | null
  pushedAt: string | null
  commits7d: number | null
  commits30d: number | null
  adminNote?: string | null
  scoringContextVersion?: number
}

export function hasNewCommitsSinceScore(repo: RepoActivitySnapshot): boolean {
  if (!repo.scoredAt) return false
  const scored = new Date(repo.scoredAt).getTime()
  if (Number.isNaN(scored)) return false

  const last = repo.lastCommitAt ?? repo.pushedAt
  if (!last) return false

  const lastTs = new Date(last).getTime()
  if (Number.isNaN(lastTs)) return false

  return lastTs > scored
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

export function commitsSinceScoreEstimate(repo: RepoActivitySnapshot): number {
  if (!repo.scoredAt || !hasNewCommitsSinceScore(repo)) return 0

  const scored = new Date(repo.scoredAt).getTime()
  if (Number.isNaN(scored)) return 0

  const days = (Date.now() - scored) / (24 * 60 * 60 * 1000)
  if (days <= 7) return repo.commits7d ?? 0
  if (days <= 30) return repo.commits30d ?? 0
  return -1
}

export function commitsSinceScoreLabel(repo: RepoActivitySnapshot): string {
  const estimate = commitsSinceScoreEstimate(repo)
  if (estimate === 0) return '0 commits since scored'
  if (estimate < 0) return 'New commits since scored'
  if (estimate >= 100) return '100+ commits since scored'
  return `${estimate} commit${estimate === 1 ? '' : 's'} since scored`
}
