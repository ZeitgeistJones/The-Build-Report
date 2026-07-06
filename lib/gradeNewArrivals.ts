import type { GitHubStats } from './github'
import type { Period } from './grades'
import { commitsInWindow } from './scoringShared'
import { isConsumerEconomicScored } from './economicGrade'
import type { Repo } from './scores'
import type { GradeArrivalCategory } from './gradeArrivalSeen'

export type GradeNewArrivalKind = 'debut' | 'category_entry'

export interface GradeNewArrival {
  slug: string
  name: string
  commits: number
  firstCommitAt: string | null
  kind: GradeNewArrivalKind
}

const MS_DAY = 24 * 60 * 60 * 1000

export function periodWindowMs(period: Period): number {
  if (period === '24h') return MS_DAY
  if (period === '7d') return 7 * MS_DAY
  if (period === '30d') return 30 * MS_DAY
  return 60 * MS_DAY
}

/** Earliest commit timestamp inside the current period window. */
export function firstCommitInWindow(
  timestamps: string[] | null | undefined,
  period: Period,
): string | null {
  if (!timestamps?.length) return null
  const cutoff = Date.now() - periodWindowMs(period)
  let earliest: number | null = null
  for (const raw of timestamps) {
    const t = new Date(raw).getTime()
    if (!Number.isFinite(t) || t < cutoff) continue
    if (earliest === null || t < earliest) earliest = t
  }
  return earliest === null ? null : new Date(earliest).toISOString()
}

/** All slugs in a category's scoring sample (for bootstrap backfill). */
export function sampleSlugsForCategory(category: GradeArrivalCategory, repos: Repo[]): string[] {
  return reposInCategorySample(category, repos).map(r => r.githubSlug)
}

function reposInCategorySample(category: GradeArrivalCategory, repos: Repo[]): Repo[] {
  if (category === 'holder-econ') {
    return repos.filter(r => isConsumerEconomicScored(r))
  }
  return repos.filter(r => r.builderIntegrity.letter !== '—')
}

/**
 * Lifetime new arrivals for a grade card: repos in sample with commits this window
 * that have never been listed in this category before (Redis seen set).
 */
export function buildGradeNewArrivals(
  stats: GitHubStats,
  repos: Repo[],
  period: Period,
  category: GradeArrivalCategory,
  seenThis: Set<string>,
  seenOther: Set<string>,
): GradeNewArrival[] {
  if (period === '60d') return []

  const sample = reposInCategorySample(category, repos)
  const arrivals: GradeNewArrival[] = []

  for (const repo of sample) {
    if (seenThis.has(repo.githubSlug)) continue
    const activity = stats.repoActivity[repo.githubSlug]
    const commits = activity ? commitsInWindow(activity, period, 'current') : 0
    if (commits <= 0) continue

    arrivals.push({
      slug: repo.githubSlug,
      name: repo.name,
      commits,
      firstCommitAt: firstCommitInWindow(activity?.commitTimestamps, period),
      kind: seenOther.has(repo.githubSlug) ? 'category_entry' : 'debut',
    })
  }

  return arrivals.sort((a, b) => b.commits - a.commits)
}
