import { getEffectiveTag as getEffectiveTagFromCriticalPath } from './criticalPath'
import type { GitHubStats, RepoActivity } from './github'
import type { Repo, Tag } from './scores'

export type ScoringPeriod = '24h' | '7d' | '30d' | '60d'
export type ScoringWindow = 'current' | 'prior'

/** Single source for 24h/7d/30d/60d × current/prior commit counts on a repo activity row. */
export function commitsInWindow(
  activity: RepoActivity,
  period: ScoringPeriod,
  window: ScoringWindow,
): number {
  if (period === '30d') {
    return window === 'current' ? (activity.commits30d ?? 0) : (activity.commits30_60 ?? 0)
  }
  if (period === '24h') {
    return window === 'current' ? (activity.commits24h ?? 0) : (activity.commits24_48 ?? 0)
  }
  if (period === '60d') {
    return window === 'current'
      ? (activity.commits30d ?? 0) + (activity.commits30_60 ?? 0)
      : 0
  }
  return window === 'current' ? (activity.commits7d ?? 0) : (activity.commits7_14 ?? 0)
}

/** Canonical tag for scoring — respects critical-path locks. */
export function effectiveTag(repo: { githubSlug: string; tag: Tag }): Tag {
  return getEffectiveTagFromCriticalPath(repo)
}

/** Holder-facing commit-share numerator: direct, supply-lock, and indirect. */
export function isHolderFacingTag(tag: Tag): boolean {
  return tag === 'direct' || tag === 'supply-lock' || tag === 'indirect'
}

/** B3: quiet window falls back to full sample so grades don't collapse on zero commits. */
export function selectSampleWithFallback<T>(active: T[], full: T[]): T[] {
  return active.length ? active : full
}

export function reposActiveInWindow(
  stats: GitHubStats,
  repoSet: Repo[],
  period: ScoringPeriod,
  window: ScoringWindow,
): Repo[] {
  return repoSet.filter(repo => {
    const live = stats.repoActivity[repo.githubSlug]
    if (!live) return false
    return commitsInWindow(live, period, window) > 0
  })
}
