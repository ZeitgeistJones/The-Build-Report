import { Repo, Tag } from './scores'
import { getEconomicScore } from './economicGrade'
import { GitHubStats, RepoActivity } from './github'
import { pctToLetter } from './gradeLetters'
import { isUnscoredRecent } from './recentRepos'
import { pctChange, trendDirection, Period, TrendDirection } from './grades'

export interface OverallGrade {
  letter: string
  pct: number
  reposScored: number
  weightsUsed: { tokenMechanic: number; builder: number; integrity: number }
}

export interface OverallGradeWithTrend extends OverallGrade {
  trendPct: number | null
  trend: TrendDirection
}

export type LetterBucketDistribution = Record<'A' | 'B' | 'C' | 'D' | 'F', number>

function emptyDistribution(): LetterBucketDistribution {
  return { A: 0, B: 0, C: 0, D: 0, F: 0 }
}

export interface OverallGradeContext {
  period: Period
  overall: OverallGrade
  tokenMechanic: { letter: string; pct: number } | null
  builder: { letter: string; pct: number } | null
  integrity: { letter: string; pct: number }
  reposWithTokenMechanicGrade: number
  tokenMechanicDistribution: LetterBucketDistribution
  builderIntegrityDistribution: LetterBucketDistribution
  dominantTags: { tag: Tag; count: number }[]
  mostActiveRepos: { name: string; commits: number }[]
  builderStats: { commits: number; activeDays: number; newRepos: number } | null
}

const NOMINAL_WEIGHTS = {
  tokenMechanic: 0.4,
  builder: 0.3,
  integrity: 0.3,
}

export function calcOverallGrade(
  tokenMechanic: { pct: number } | null,
  builder: { pct: number } | null,
  integrity: { pct: number } | null,
  reposScored: number,
): OverallGrade | null {
  if (!integrity || reposScored === 0) return null

  const axes: { pct: number; weight: number; key: keyof typeof NOMINAL_WEIGHTS }[] = []
  if (tokenMechanic) axes.push({ pct: tokenMechanic.pct, weight: NOMINAL_WEIGHTS.tokenMechanic, key: 'tokenMechanic' })
  if (builder) axes.push({ pct: builder.pct, weight: NOMINAL_WEIGHTS.builder, key: 'builder' })
  axes.push({ pct: integrity.pct, weight: NOMINAL_WEIGHTS.integrity, key: 'integrity' })

  const totalWeight = axes.reduce((s, a) => s + a.weight, 0)
  const pct = Math.round(
    axes.reduce((s, a) => s + a.pct * (a.weight / totalWeight), 0),
  )

  const weightsUsed = { tokenMechanic: 0, builder: 0, integrity: 0 }
  for (const axis of axes) {
    weightsUsed[axis.key] = axis.weight / totalWeight
  }

  return {
    letter: pctToLetter(pct),
    pct,
    reposScored,
    weightsUsed,
  }
}

export function calcOverallGradeWithTrend(
  tokenMechanic: { pct: number; priorPct: number | null } | null,
  builder: { pct: number; priorPct: number | null } | null,
  integrity: { pct: number; priorPct: number | null },
  reposScored: number,
  period: Period,
): OverallGradeWithTrend | null {
  const overall = calcOverallGrade(tokenMechanic, builder, integrity, reposScored)
  if (!overall) return null

  // 60d has no prior window by design — never show a trend.
  if (period === '60d') {
    return { ...overall, trendPct: null, trend: 'flat' }
  }

  // Build the prior blend from only the axes that actually have a prior value, renormalizing
  // their weights. Treating a missing prior as 0 would deflate the prior Overall and fake a spike.
  const priorAxes: { pct: number; weight: number }[] = []
  if (tokenMechanic && tokenMechanic.priorPct != null) {
    priorAxes.push({ pct: tokenMechanic.priorPct, weight: NOMINAL_WEIGHTS.tokenMechanic })
  }
  if (builder && builder.priorPct != null) {
    priorAxes.push({ pct: builder.priorPct, weight: NOMINAL_WEIGHTS.builder })
  }
  if (integrity.priorPct != null) {
    priorAxes.push({ pct: integrity.priorPct, weight: NOMINAL_WEIGHTS.integrity })
  }

  if (!priorAxes.length) {
    return { ...overall, trendPct: null, trend: 'new' }
  }

  const totalWeight = priorAxes.reduce((s, a) => s + a.weight, 0)
  const priorPct = Math.round(
    priorAxes.reduce((s, a) => s + a.pct * (a.weight / totalWeight), 0),
  )

  const trendPct = pctChange(overall.pct, priorPct)

  return {
    ...overall,
    trendPct,
    trend: trendDirection(overall.pct, priorPct),
  }
}

export function countReposScored(repos: Repo[]): number {
  return repos.filter(r => !isUnscoredRecent(r)).length
}

function letterBucket(letter: string): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (letter.startsWith('F')) return 'F'
  if (letter.startsWith('A')) return 'A'
  if (letter.startsWith('B')) return 'B'
  if (letter.startsWith('C')) return 'C'
  return 'D'
}

function commitsForActivity(activity: RepoActivity, period: Period): number {
  if (period === '7d') return activity.commits7d
  if (period === '30d') return activity.commits30d
  return activity.commits30d + activity.commits30_60
}

export function buildOverallGradeContext(
  overall: OverallGrade,
  tokenMechanic: { letter: string; pct: number } | null,
  builder: { letter: string; pct: number } | null,
  integrity: { letter: string; pct: number },
  repos: Repo[],
  stats: GitHubStats | null,
  period: Period,
): OverallGradeContext {
  const scored = repos.filter(r => !isUnscoredRecent(r))
  const tokenMechanicDistribution = emptyDistribution()
  const builderIntegrityDistribution = emptyDistribution()
  let reposWithTokenMechanicGrade = 0

  for (const repo of scored) {
    const economic = getEconomicScore(repo)
    if (economic) {
      reposWithTokenMechanicGrade++
      tokenMechanicDistribution[letterBucket(economic.letter)]++
    }
    builderIntegrityDistribution[letterBucket(repo.builderIntegrity.letter)]++
  }

  const tagCounts = new Map<Tag, number>()
  for (const repo of scored) {
    tagCounts.set(repo.tag, (tagCounts.get(repo.tag) ?? 0) + 1)
  }
  const dominantTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)

  const mostActiveRepos = stats
    ? Object.values(stats.repoActivity)
        .map(a => ({ name: a.slug, commits: commitsForActivity(a, period) }))
        .filter(r => r.commits > 0)
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 5)
    : []

  const builderStats = stats
    ? period === '7d'
      ? {
          commits: stats.totalCommits7d,
          activeDays: stats.activeDays7d,
          newRepos: stats.newRepos7d,
        }
      : period === '30d'
        ? {
            commits: stats.totalCommits30d,
            activeDays: stats.activeDays30d,
            newRepos: stats.newRepos30d,
          }
        : {
            commits: stats.totalCommits30d + stats.totalCommits30_60,
            activeDays: stats.activeDays30d + stats.activeDays30_60,
            newRepos: stats.newRepos30d + stats.newRepos30_60,
          }
    : null

  return {
    period,
    overall,
    tokenMechanic,
    builder,
    integrity,
    reposWithTokenMechanicGrade,
    tokenMechanicDistribution,
    builderIntegrityDistribution,
    dominantTags,
    mostActiveRepos,
    builderStats,
  }
}
