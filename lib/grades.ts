import { REPOS } from './scores'
import { GitHubStats } from './github'

export type Period = '30d' | '7d'

export interface BuilderGrade {
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trend: 'up' | 'flat' | 'down'
}

export interface HolderRelevanceGrade {
  counts: { direct: number; lock: number; indirect: number; infra: number }
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trend: 'up' | 'flat' | 'down'
}

export interface IntegrityGrade {
  counts: { active: number; high: number; mid: number; low: number }
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trend: 'up' | 'flat' | 'down'
}

function toLevel(pct: number): 'high' | 'mid' | 'low' {
  if (pct >= 0.66) return 'high'
  if (pct >= 0.33) return 'mid'
  return 'low'
}

function pctToLetter(pct: number): string {
  if (pct >= 80) return 'A'
  if (pct >= 60) return 'B'
  if (pct >= 40) return 'C'
  return 'D'
}

function avg(nums: number[]) {
  if (!nums.length) return 0
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function trendFor(curr: number, prev: number): 'up' | 'flat' | 'down' {
  if (curr > prev + 3) return 'up'
  if (curr < prev - 3) return 'down'
  return 'flat'
}

export function calcBuilderGrade(stats: GitHubStats, period: Period): BuilderGrade {
  const commits = period === '30d' ? stats.totalCommits30d : stats.totalCommits7d
  const activeDays = period === '30d' ? stats.activeDays30d : stats.activeDays7d
  const newRepos = period === '30d' ? stats.newRepos30d : stats.newRepos7d
  const periodDays = period === '30d' ? 30 : 7
  const activeRepos = Object.values(stats.repoActivity).filter(r => (period === '30d' ? r.commits30d : r.commits7d) > 0).length

  const commitPct = Math.min(commits / (period === '30d' ? 60 : 14), 1)
  const activeDaysPct = Math.min(activeDays / periodDays, 1)
  const newReposPct = Math.min(newRepos / (period === '30d' ? 4 : 2), 1)
  const activeReposPct = Math.min(activeRepos / Math.max(Object.keys(stats.repoActivity).length * 0.5, 1), 1)
  const consistencyPct = Math.min(activeDays / Math.max(periodDays * 0.7, 1), 1)

  const signalPcts = [commitPct, activeDaysPct, newReposPct, activeReposPct, consistencyPct]
  const pct = Math.round((signalPcts.reduce((a, b) => a + b, 0) / signalPcts.length) * 100)
  const letter = pctToLetter(pct)

  const trend = period === '30d'
    ? stats.trend30vs30
    : trendFor(stats.totalCommits7d, Math.round(stats.totalCommits30d / 4))

  return {
    letter,
    pct,
    trend,
    summary:
      pct >= 80
        ? 'Strong recent build activity across commits, active days, and repo movement.'
        : pct >= 60
          ? 'Solid recent shipping pace with some unevenness across activity signals.'
          : pct >= 40
            ? 'Some activity is present, but the recent build cadence is mixed.'
            : 'Recent build activity is light relative to the tracked repo set.',
    signals: [
      { label: 'Commit frequency', level: toLevel(commitPct), pct: Math.round(commitPct * 100) },
      { label: 'Active days', level: toLevel(activeDaysPct), pct: Math.round(activeDaysPct * 100) },
      { label: 'New repos', level: toLevel(newReposPct), pct: Math.round(newReposPct * 100) },
      { label: 'Repos with commits', level: toLevel(activeReposPct), pct: Math.round(activeReposPct * 100) },
      { label: 'Consistency', level: toLevel(consistencyPct), pct: Math.round(consistencyPct * 100) },
    ],
  }
}

export function calcHolderRelevanceGrade(stats: GitHubStats, period: Period): HolderRelevanceGrade {
  const activeRepos = REPOS.filter(repo => {
    const live = stats.repoActivity[repo.githubSlug]
    if (!live) return false
    return period === '30d' ? live.commits30d > 0 : live.commits7d > 0
  })

  const counts = {
    direct: activeRepos.filter(r => r.tag === 'direct').length,
    lock: activeRepos.filter(r => r.tag === 'supply-lock').length,
    indirect: activeRepos.filter(r => r.tag === 'indirect').length,
    infra: activeRepos.filter(r => r.tag === 'infrastructure' || r.tag === 'theoretical').length,
  }

  const total = activeRepos.length || 1
  const pctRaw = ((counts.direct * 1 + counts.lock * 0.75 + counts.indirect * 0.55 + counts.infra * 0.2) / total) * 100
  const pct = Math.round(pctRaw)
  const letter = pctToLetter(pct)

  const prevPct = Math.round(Math.max(pct - (counts.direct > counts.infra ? 2 : -2), 0))

  return {
    counts,
    letter,
    pct,
    trend: trendFor(pct, prevPct),
    summary:
      pct >= 80
        ? 'Most recently active repos are directly aligned with holder value.'
        : pct >= 60
          ? 'A healthy share of recent activity points toward holder value, with some infra mixed in.'
          : pct >= 40
            ? 'Recent activity is split between holder-facing work and infrastructure.'
            : 'Recent activity leans more toward infrastructure and R&D than direct holder value.',
    signals: [
      { label: 'Direct burn', level: toLevel(counts.direct / total), pct: Math.round((counts.direct / total) * 100) },
      { label: 'Supply lock', level: toLevel(counts.lock / total), pct: Math.round((counts.lock / total) * 100) },
      { label: 'Indirect value', level: toLevel(counts.indirect / total), pct: Math.round((counts.indirect / total) * 100) },
      { label: 'Infra drag', level: toLevel(1 - counts.infra / total), pct: Math.round((1 - counts.infra / total) * 100) },
    ],
  }
}

export function calcIntegrityGrade(stats: GitHubStats | null, period: Period, repoSet = REPOS): IntegrityGrade {
  const activeRepos = !stats
    ? repoSet
    : repoSet.filter(repo => {
        const live = stats.repoActivity[repo.githubSlug]
        if (!live) return false
        return period === '30d' ? live.commits30d > 0 : live.commits7d > 0
      })

  const sample = activeRepos.length ? activeRepos : repoSet
  const scores = sample.map(repo => repo.builderIntegrity.pct)
  const pct = avg(scores)
  const prevSample = repoSet.slice(0, Math.max(sample.length - 1, 1))
  const prevPct = avg(prevSample.map(repo => repo.builderIntegrity.pct))

  const high = sample.filter(r => r.builderIntegrity.pct >= 80).length
  const mid = sample.filter(r => r.builderIntegrity.pct >= 60 && r.builderIntegrity.pct < 80).length
  const low = sample.filter(r => r.builderIntegrity.pct < 60).length

  const visionAvg = avg(sample.map(r => {
    const row = r.builderIntegrity.rubric.find(x => x.label === 'Serves stated vision at time of build')
    return row?.level === 'high' ? 100 : row?.level === 'mid' ? 67 : 33
  }))

  const autonomyAvg = avg(sample.map(r => {
    const row = r.builderIntegrity.rubric.find(x => x.label === 'Genuine autonomous build')
    return row?.level === 'high' ? 100 : row?.level === 'mid' ? 67 : 33
  }))

  const walkawayAvg = avg(sample.map(r => {
    const row = r.builderIntegrity.rubric.find(x => x.label === 'Passes walkaway test')
    return row?.level === 'high' ? 100 : row?.level === 'mid' ? 67 : 33
  }))

  return {
    counts: { active: sample.length, high, mid, low },
    letter: pctToLetter(pct),
    pct,
    trend: trendFor(pct, prevPct),
    summary:
      pct >= 80
        ? 'Recent active repos are strongly aligned with the original builder-values rubric.'
        : pct >= 60
          ? 'Most recent active repos still fit the stated builder-values frame, with some weaker walkaway or vision alignment.'
          : pct >= 40
            ? 'Integrity is mixed across the active repo set.'
            : 'The active repo set scores weakly against the original builder-values rubric.',
    signals: [
      { label: 'Stated vision', level: toLevel(visionAvg / 100), pct: visionAvg },
      { label: 'Autonomous build', level: toLevel(autonomyAvg / 100), pct: autonomyAvg },
      { label: 'Walkaway test', level: toLevel(walkawayAvg / 100), pct: walkawayAvg },
      { label: 'High-integrity share', level: toLevel(high / Math.max(sample.length, 1)), pct: Math.round((high / Math.max(sample.length, 1)) * 100) },
    ],
  }
}
