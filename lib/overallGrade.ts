import { Repo, Tag } from './scores'
import { GitHubStats } from './github'
import { pctToLetter } from './gradeLetters'
import { isUnscoredRecent } from './recentRepos'
import { pctChange, trendFromPct } from './grades'

export interface OverallGrade {
  letter: string
  pct: number
  reposScored: number
  weightsUsed: { tokenMechanic: number; builder: number; integrity: number }
}

export interface OverallGradeWithTrend extends OverallGrade {
  trendPct: number | null
  trend: 'up' | 'flat' | 'down'
}

export interface OverallGradeContext {
  overall: OverallGrade
  tokenMechanic: { letter: string; pct: number } | null
  builder: { letter: string; pct: number } | null
  integrity: { letter: string; pct: number }
  gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'F', number>
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

function priorPctFromTrend(curr: number, trendPct: number | null): number {
  if (trendPct === null) return 0
  if (trendPct === 0) return curr
  return Math.round(curr / (1 + trendPct / 100))
}

export function calcOverallGradeWithTrend(
  tokenMechanic: { pct: number; trendPct: number | null } | null,
  builder: { pct: number; trendPct: number | null } | null,
  integrity: { pct: number; trendPct: number | null },
  reposScored: number,
): OverallGradeWithTrend | null {
  const overall = calcOverallGrade(tokenMechanic, builder, integrity, reposScored)
  if (!overall) return null

  const priorOverall = calcOverallGrade(
    tokenMechanic ? { pct: priorPctFromTrend(tokenMechanic.pct, tokenMechanic.trendPct) } : null,
    builder ? { pct: priorPctFromTrend(builder.pct, builder.trendPct) } : null,
    { pct: priorPctFromTrend(integrity.pct, integrity.trendPct) },
    reposScored,
  )

  const trendPct = pctChange(overall.pct, priorOverall?.pct ?? 0)

  return {
    ...overall,
    trendPct,
    trend: trendFromPct(trendPct),
  }
}

export function countReposScored(repos: Repo[]): number {
  return repos.filter(r => !isUnscoredRecent(r)).length
}

function letterBucket(letter: string): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (letter === 'F') return 'F'
  if (letter.startsWith('A')) return 'A'
  if (letter.startsWith('B')) return 'B'
  if (letter.startsWith('C')) return 'C'
  return 'D'
}

export function buildOverallGradeContext(
  overall: OverallGrade,
  tokenMechanic: { letter: string; pct: number } | null,
  builder: { letter: string; pct: number } | null,
  integrity: { letter: string; pct: number },
  repos: Repo[],
  stats: GitHubStats | null,
): OverallGradeContext {
  const scored = repos.filter(r => !isUnscoredRecent(r))
  const gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'F', number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    F: 0,
  }

  for (const repo of scored) {
    if (repo.tokenMechanic) {
      gradeDistribution[letterBucket(repo.tokenMechanic.letter)]++
    }
    gradeDistribution[letterBucket(repo.builderIntegrity.letter)]++
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
        .map(a => ({ name: a.slug, commits: a.commits30d }))
        .filter(r => r.commits > 0)
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 5)
    : []

  return {
    overall,
    tokenMechanic,
    builder,
    integrity,
    gradeDistribution,
    dominantTags,
    mostActiveRepos,
    builderStats: stats
      ? {
          commits: stats.totalCommits30d,
          activeDays: stats.activeDays30d,
          newRepos: stats.newRepos30d,
        }
      : null,
  }
}
