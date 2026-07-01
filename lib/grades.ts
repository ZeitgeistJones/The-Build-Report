import { Repo } from './scores'
import { GitHubStats } from './github'

export type Period = '30d' | '7d'

export interface BuilderGrade {
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: 'up' | 'flat' | 'down'
}

export interface HolderRelevanceGrade {
  counts: { direct: number; lock: number; indirect: number; infra: number }
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: 'up' | 'flat' | 'down'
}

export interface IntegrityGrade {
  counts: { active: number; high: number; mid: number; low: number }
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: 'up' | 'flat' | 'down'
}

export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? null : 0
  return Math.round(((curr - prev) / prev) * 100)
}

export function trendFromPct(change: number | null): 'up' | 'flat' | 'down' {
  if (change === null) return 'up'
  if (change > 3) return 'up'
  if (change < -3) return 'down'
  return 'flat'
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

interface BuilderInputs {
  commits: number
  activeDays: number
  newRepos: number
  activeRepos: number
  scannedRepos: number
  periodDays: number
}

function builderInputsFromStats(stats: GitHubStats, period: Period, window: 'current' | 'prior'): BuilderInputs {
  const periodDays = period === '30d' ? 30 : 7
  const activityCount = Object.keys(stats.repoActivity).length

  if (period === '30d') {
    const activeRepos = Object.values(stats.repoActivity).filter(r =>
      window === 'current' ? r.commits30d > 0 : r.commits30_60 > 0,
    ).length
    return {
      commits: window === 'current' ? stats.totalCommits30d : stats.totalCommits30_60,
      activeDays: window === 'current' ? stats.activeDays30d : stats.activeDays30_60,
      newRepos: window === 'current' ? stats.newRepos30d : stats.newRepos30_60,
      activeRepos,
      scannedRepos: activityCount,
      periodDays,
    }
  }

  const activeRepos = Object.values(stats.repoActivity).filter(r =>
    window === 'current' ? r.commits7d > 0 : r.commits7_14 > 0,
  ).length
  return {
    commits: window === 'current' ? stats.totalCommits7d : stats.totalCommits7_14,
    activeDays: window === 'current' ? stats.activeDays7d : stats.activeDays7_14,
    newRepos: window === 'current' ? stats.newRepos7d : stats.newRepos7_14,
    activeRepos,
    scannedRepos: activityCount,
    periodDays,
  }
}

function calcBuilderPct(inputs: BuilderInputs, period: Period): number {
  const { commits, activeDays, newRepos, activeRepos, scannedRepos, periodDays } = inputs
  const commitPct = Math.min(commits / (period === '30d' ? 60 : 14), 1)
  const activeDaysPct = Math.min(activeDays / periodDays, 1)
  const newReposPct = Math.min(newRepos / (period === '30d' ? 4 : 2), 1)
  const activeReposPct = Math.min(activeRepos / Math.max(scannedRepos * 0.5, 1), 1)
  const consistencyPct = Math.min(activeDays / Math.max(periodDays * 0.7, 1), 1)
  const signalPcts = [commitPct, activeDaysPct, newReposPct, activeReposPct, consistencyPct]
  return Math.round((signalPcts.reduce((a, b) => a + b, 0) / signalPcts.length) * 100)
}

function builderSignals(inputs: BuilderInputs, period: Period) {
  const { commits, activeDays, newRepos, activeRepos, scannedRepos, periodDays } = inputs
  const commitPct = Math.min(commits / (period === '30d' ? 60 : 14), 1)
  const activeDaysPct = Math.min(activeDays / periodDays, 1)
  const newReposPct = Math.min(newRepos / (period === '30d' ? 4 : 2), 1)
  const activeReposPct = Math.min(activeRepos / Math.max(scannedRepos * 0.5, 1), 1)
  const consistencyPct = Math.min(activeDays / Math.max(periodDays * 0.7, 1), 1)
  return [
    { label: 'Commit frequency', level: toLevel(commitPct), pct: Math.round(commitPct * 100) },
    { label: 'Active days', level: toLevel(activeDaysPct), pct: Math.round(activeDaysPct * 100) },
    { label: 'New repos', level: toLevel(newReposPct), pct: Math.round(newReposPct * 100) },
    { label: 'Repos with commits', level: toLevel(activeReposPct), pct: Math.round(activeReposPct * 100) },
    { label: 'Consistency', level: toLevel(consistencyPct), pct: Math.round(consistencyPct * 100) },
  ]
}

export function calcBuilderGrade(stats: GitHubStats, period: Period): BuilderGrade {
  const current = builderInputsFromStats(stats, period, 'current')
  const prior = builderInputsFromStats(stats, period, 'prior')
  const pct = calcBuilderPct(current, period)
  const priorPct = calcBuilderPct(prior, period)
  const trendPct = pctChange(pct, priorPct)
  const letter = pctToLetter(pct)

  return {
    letter,
    pct,
    trendPct,
    trend: trendFromPct(trendPct),
    summary:
      pct >= 80
        ? 'Strong recent build activity across commits, active days, and repo movement.'
        : pct >= 60
          ? 'Solid recent shipping pace with some unevenness across activity signals.'
          : pct >= 40
            ? 'Some activity is present, but the recent build cadence is mixed.'
            : 'Recent build activity is light relative to the tracked repo set.',
    signals: builderSignals(current, period),
  }
}

function holderPctFromRepos(activeRepos: Repo[]): number {
  const counts = {
    direct: activeRepos.filter(r => r.tag === 'direct').length,
    lock: activeRepos.filter(r => r.tag === 'supply-lock').length,
    indirect: activeRepos.filter(r => r.tag === 'indirect').length,
    infra: activeRepos.filter(r => r.tag === 'infrastructure' || r.tag === 'theoretical').length,
  }
  const total = activeRepos.length || 1
  return Math.round(((counts.direct * 1 + counts.lock * 0.75 + counts.indirect * 0.55 + counts.infra * 0.2) / total) * 100)
}

function holderCounts(activeRepos: Repo[]) {
  return {
    direct: activeRepos.filter(r => r.tag === 'direct').length,
    lock: activeRepos.filter(r => r.tag === 'supply-lock').length,
    indirect: activeRepos.filter(r => r.tag === 'indirect').length,
    infra: activeRepos.filter(r => r.tag === 'infrastructure' || r.tag === 'theoretical').length,
  }
}

function reposActiveInWindow(stats: GitHubStats, repoSet: Repo[], period: Period, window: 'current' | 'prior') {
  return repoSet.filter(repo => {
    const live = stats.repoActivity[repo.githubSlug]
    if (!live) return false
    if (period === '30d') {
      return window === 'current' ? live.commits30d > 0 : live.commits30_60 > 0
    }
    return window === 'current' ? live.commits7d > 0 : live.commits7_14 > 0
  })
}

export function calcHolderRelevanceGrade(stats: GitHubStats, period: Period, repoSet: Repo[]): HolderRelevanceGrade {
  const activeRepos = reposActiveInWindow(stats, repoSet, period, 'current')
  const priorActiveRepos = reposActiveInWindow(stats, repoSet, period, 'prior')

  const counts = holderCounts(activeRepos)
  const total = activeRepos.length || 1
  const pct = holderPctFromRepos(activeRepos)
  const priorPct = holderPctFromRepos(priorActiveRepos)
  const trendPct = pctChange(pct, priorPct)
  const letter = pctToLetter(pct)

  return {
    counts,
    letter,
    pct,
    trendPct,
    trend: trendFromPct(trendPct),
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
      { label: 'Non-infra share', level: toLevel(1 - counts.infra / total), pct: Math.round((1 - counts.infra / total) * 100) },
    ],
  }
}

export function calcIntegrityGrade(stats: GitHubStats | null, period: Period, repoSet: Repo[]): IntegrityGrade {
  const activeRepos = !stats
    ? repoSet
    : reposActiveInWindow(stats, repoSet, period, 'current')

  const priorActiveRepos = !stats
    ? repoSet
    : reposActiveInWindow(stats, repoSet, period, 'prior')

  const sample = activeRepos.length ? activeRepos : repoSet
  const priorSample = priorActiveRepos

  const scores = sample.map(repo => repo.builderIntegrity.pct)
  const pct = avg(scores)
  const priorPct = priorSample.length ? avg(priorSample.map(repo => repo.builderIntegrity.pct)) : 0
  const trendPct = pctChange(pct, priorPct)

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
    trendPct,
    trend: trendFromPct(trendPct),
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

export function formatTrendPct(trendPct: number | null, period: Period): string {
  const windowLabel = period === '30d' ? 'prior 30d' : 'prior 7d'
  if (trendPct === null) return `new vs ${windowLabel}`
  if (trendPct > 0) return `+${trendPct}% vs ${windowLabel}`
  if (trendPct < 0) return `${trendPct}% vs ${windowLabel}`
  return `0% vs ${windowLabel}`
}
