import { Repo } from './scores'
import { GitHubStats } from './github'
import { pctToLetter } from './gradeLetters'

export type Period = '30d' | '7d'

export interface TrendExplanation {
  headline: string
  bullets: string[]
}

export interface BuilderGrade {
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: 'up' | 'flat' | 'down'
  trendExplanation?: TrendExplanation
}

export interface TokenMechanicGrade {
  counts: { direct: number; lock: number; indirect: number; infra: number; repos: number }
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: 'up' | 'flat' | 'down'
  trendExplanation?: TrendExplanation
}

export interface IntegrityGrade {
  counts: { active: number; high: number; mid: number; low: number; commitWeight: number }
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: 'up' | 'flat' | 'down'
  trendExplanation?: TrendExplanation
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

function commitsForRepo(
  stats: GitHubStats,
  slug: string,
  period: Period,
  window: 'current' | 'prior',
): number {
  const live = stats.repoActivity[slug]
  if (!live) return 0
  if (period === '30d') {
    return window === 'current' ? live.commits30d : live.commits30_60
  }
  return window === 'current' ? live.commits7d : live.commits7_14
}

const HOLDER_TAG_VALUE: Record<Repo['tag'], number> = {
  direct: 1,
  'supply-lock': 0.75,
  indirect: 0.55,
  infrastructure: 0.2,
  theoretical: 0.2,
}

function tokenMechanicPctWeighted(
  stats: GitHubStats,
  activeRepos: Repo[],
  period: Period,
  window: 'current' | 'prior',
): number {
  let weightedSum = 0
  let totalCommits = 0
  for (const repo of activeRepos) {
    const w = commitsForRepo(stats, repo.githubSlug, period, window)
    if (w <= 0) continue
    weightedSum += HOLDER_TAG_VALUE[repo.tag] * w
    totalCommits += w
  }
  if (totalCommits === 0) return 0
  return Math.round((weightedSum / totalCommits) * 100)
}

function tokenMechanicCommitCounts(
  stats: GitHubStats,
  activeRepos: Repo[],
  period: Period,
  window: 'current' | 'prior',
) {
  const counts = { direct: 0, lock: 0, indirect: 0, infra: 0, repos: activeRepos.length }
  for (const repo of activeRepos) {
    const w = commitsForRepo(stats, repo.githubSlug, period, window)
    if (repo.tag === 'direct') counts.direct += w
    else if (repo.tag === 'supply-lock') counts.lock += w
    else if (repo.tag === 'indirect') counts.indirect += w
    else counts.infra += w
  }
  return counts
}

function tokenMechanicTotalCommits(counts: { direct: number; lock: number; indirect: number; infra: number }): number {
  return counts.direct + counts.lock + counts.indirect + counts.infra
}

function weightedAvgByCommits(
  stats: GitHubStats,
  repos: Repo[],
  period: Period,
  window: 'current' | 'prior',
  scoreFn: (repo: Repo) => number,
): number {
  let sum = 0
  let weight = 0
  for (const repo of repos) {
    const w = commitsForRepo(stats, repo.githubSlug, period, window)
    if (w <= 0) continue
    sum += scoreFn(repo) * w
    weight += w
  }
  return weight ? Math.round(sum / weight) : 0
}

function integrityCommitCounts(
  stats: GitHubStats,
  repos: Repo[],
  period: Period,
  window: 'current' | 'prior',
) {
  let high = 0
  let mid = 0
  let low = 0
  let total = 0
  for (const repo of repos) {
    if (repo.builderIntegrity.letter === '—') continue
    const w = commitsForRepo(stats, repo.githubSlug, period, window)
    if (w <= 0) continue
    total += w
    if (repo.builderIntegrity.pct >= 80) high += w
    else if (repo.builderIntegrity.pct >= 60) mid += w
    else low += w
  }
  return { active: repos.length, high, mid, low, commitWeight: total }
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

export function calcTokenMechanicGrade(stats: GitHubStats, period: Period, repoSet: Repo[]): TokenMechanicGrade {
  const activeRepos = reposActiveInWindow(stats, repoSet, period, 'current')
  const priorActiveRepos = reposActiveInWindow(stats, repoSet, period, 'prior')

  const counts = tokenMechanicCommitCounts(stats, activeRepos, period, 'current')
  const totalCommits = tokenMechanicTotalCommits(counts) || 1
  const pct = tokenMechanicPctWeighted(stats, activeRepos, period, 'current')
  const priorPct = tokenMechanicPctWeighted(stats, priorActiveRepos, period, 'prior')
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
        ? 'Most commit volume in this window is on directly holder-aligned repos.'
        : pct >= 60
          ? 'A healthy share of commits points toward holder value, with some infra mixed in.'
          : pct >= 40
            ? 'Commit volume is split between holder-facing work and infrastructure.'
            : 'Recent commits lean more toward infrastructure and R&D than direct holder value.',
    signals: [
      { label: 'Direct burn', level: toLevel(counts.direct / totalCommits), pct: Math.round((counts.direct / totalCommits) * 100) },
      { label: 'Supply lock', level: toLevel(counts.lock / totalCommits), pct: Math.round((counts.lock / totalCommits) * 100) },
      { label: 'Indirect value', level: toLevel(counts.indirect / totalCommits), pct: Math.round((counts.indirect / totalCommits) * 100) },
      { label: 'Non-infra share', level: toLevel(1 - counts.infra / totalCommits), pct: Math.round((1 - counts.infra / totalCommits) * 100) },
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

  const pct = !stats
    ? avg(sample.map(repo => repo.builderIntegrity.pct))
    : weightedAvgByCommits(stats, sample, period, 'current', r => r.builderIntegrity.pct)

  const priorPct = !stats || !priorSample.length
    ? 0
    : weightedAvgByCommits(stats, priorSample, period, 'prior', r => r.builderIntegrity.pct)

  const trendPct = pctChange(pct, priorPct)

  const commitCounts = stats
    ? integrityCommitCounts(stats, sample, period, 'current')
    : {
        active: sample.length,
        high: sample.filter(r => r.builderIntegrity.pct >= 80).length,
        mid: sample.filter(r => r.builderIntegrity.pct >= 60 && r.builderIntegrity.pct < 80).length,
        low: sample.filter(r => r.builderIntegrity.pct < 60).length,
        commitWeight: 0,
      }

  const { high, mid, low, commitWeight } = commitCounts
  const weightBase = commitWeight || 1

  const rubricScore = (repo: Repo, label: string) => {
    const row = repo.builderIntegrity.rubric.find(x => x.label === label)
    return row?.level === 'high' ? 100 : row?.level === 'mid' ? 67 : 33
  }

  const visionAvg = stats
    ? weightedAvgByCommits(stats, sample, period, 'current', r => rubricScore(r, 'Serves stated vision at time of build'))
    : avg(sample.map(r => rubricScore(r, 'Serves stated vision at time of build')))

  const autonomyAvg = stats
    ? weightedAvgByCommits(stats, sample, period, 'current', r => rubricScore(r, 'Genuine autonomous build'))
    : avg(sample.map(r => rubricScore(r, 'Genuine autonomous build')))

  const walkawayAvg = stats
    ? weightedAvgByCommits(stats, sample, period, 'current', r => rubricScore(r, 'Passes walkaway test'))
    : avg(sample.map(r => rubricScore(r, 'Passes walkaway test')))

  return {
    counts: { active: sample.length, high, mid, low, commitWeight },
    letter: pctToLetter(pct),
    pct,
    trendPct,
    trend: trendFromPct(trendPct),
    summary:
      pct >= 80
        ? 'Repos seeing the most commits score strongly on the builder-values rubric.'
        : pct >= 60
          ? 'Heavy commit repos mostly fit the stated builder-values frame, with some weaker alignment.'
          : pct >= 40
            ? 'Integrity is mixed across where commit volume landed this window.'
            : 'Most commits this window landed on repos with weaker builder-values scores.',
    signals: [
      { label: 'Stated vision', level: toLevel(visionAvg / 100), pct: visionAvg },
      { label: 'Autonomous build', level: toLevel(autonomyAvg / 100), pct: autonomyAvg },
      { label: 'Walkaway test', level: toLevel(walkawayAvg / 100), pct: walkawayAvg },
      { label: 'High-integrity share', level: toLevel(high / weightBase), pct: Math.round((high / weightBase) * 100) },
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
