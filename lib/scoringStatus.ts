import { Repo } from './scores'
import { isUnscoredRecent } from './recentRepos'

export type ScoringStatus = 'unscored' | 'scored'

export function getScoringStatus(repo: Repo): ScoringStatus {
  return isUnscoredRecent(repo) ? 'unscored' : 'scored'
}
