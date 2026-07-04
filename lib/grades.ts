import { Repo } from './scores'
import { GitHubStats } from './github'
import { pctToLetter } from './gradeLetters'
import {
  BUILDER_ACTIVITY_SIGNALS,
  builderActivitySummary,
  computeBuilderActivityScore,
  computeSignalRatio,
  periodToWindowKey,
  type BuilderActivityActuals,
  windowLengthDays,
} from './rubrics/builderActivity'
import {
  BI_ROW_LABELS,
  LEGACY_BI_LABELS,
} from './rubrics/builderIntegrity'
import {
  LEGACY_TM_LABELS,
  TM_CONSUMER_LABELS,
} from './rubrics/tokenMechanic'
import {
  SL_LABELS,
  slRubricLevelScore,
} from './rubrics/shippingLeverage'
import { getConsumerEconomicScorePct, isConsumerEconomicScored, isEcosystemIntegritySample } from './economicGrade'

export { pctToLetter }

/** Map numeric score (0–100) to letter grade. Delegates to {@link pctToLetter}. */
export function letterGrade(pct: number): string {
  return pctToLetter(pct)
}

export type Period = '30d' | '7d' | '60d'

/** Extended period for repo list filtering — includes prior comparison windows. */
export type PeriodKey = Period | '7d-prior' | '30d-prior'

export const PERIOD_TOGGLE_OPTIONS: { key: PeriodKey; label: string; short: string }[] = [
  { key: '7d', label: 'Last 7 days', short: '7d' },
  { key: '7d-prior', label: 'Prior 7 days (8–14)', short: '7d prev' },
  { key: '30d', label: 'Last 30 days', short: '30d' },
  { key: '30d-prior', label: 'Prior 30 days (31–60)', short: '30d prev' },
  { key: '60d', label: 'Last 60 days', short: '60d' },
]

export function periodKeyToBase(pk: PeriodKey): Period {
  if (pk === '7d-prior') return '7d'
  if (pk === '30d-prior') return '30d'
  return pk
}

export function periodKeyLabel(pk: PeriodKey): string {
  return PERIOD_TOGGLE_OPTIONS.find(o => o.key === pk)?.short ?? pk
}

export function periodKeyWindowHint(pk: PeriodKey): string | null {
  if (pk === '7d-prior') return 'days 8–14'
  if (pk === '30d-prior') return 'days 31–60'
  return null
}

export function repoCommitsForPeriodKey(
  repo: {
    commits7d?: number | null
    commits7_14?: number | null
    commits30d?: number | null
    commits30_60?: number | null
  },
  pk: PeriodKey,
): number {
  switch (pk) {
    case '7d':
      return repo.commits7d ?? 0
    case '7d-prior':
      return repo.commits7_14 ?? 0
    case '30d':
      return repo.commits30d ?? 0
    case '30d-prior':
      return repo.commits30_60 ?? 0
    case '60d':
      return (repo.commits30d ?? 0) + (repo.commits30_60 ?? 0)
  }
}

export interface TrendExplanation {
  headline: string
  bullets: string[]
}

export interface BuilderGrade {
  letter: string
  pct: number
  priorPct: number | null
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: 'up' | 'flat' | 'down'
  trendExplanation?: TrendExplanation
}

export interface TokenMechanicGrade {
  counts: { direct: number; lock: number; indirect: number; infra: number; repos: number }
  tagCommits?: { direct: number; lock: number; indirect: number; infra: number }
  letter: string
  pct: number
  priorPct: number | null
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
  priorPct: number | null
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
  const activityCount = Object.keys(stats.repoActivity).length

  if (period === '60d') {
    const activeRepos = Object.values(stats.repoActivity).filter(
      r => r.commits30d + r.commits30_60 > 0,
    ).length
    return {
      commits: stats.totalCommits30d + stats.totalCommits30_60,
      activeDays: stats.activeDays30d + stats.activeDays30_60,
      newRepos: stats.newRepos30d + stats.newRepos30_60,
      activeRepos,
      scannedRepos: activityCount,
      periodDays: 60,
    }
  }

  const periodDays = period === '30d' ? 30 : 7

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

function builderActualsFromInputs(inputs: BuilderInputs): BuilderActivityActuals {
  return {
    totalCommits: inputs.commits,
    activeDays: inputs.activeDays,
    newRepos: inputs.newRepos,
    reposWithCommits: inputs.activeRepos,
  }
}

function calcBuilderPct(inputs: BuilderInputs, period: Period): number {
  return computeBuilderActivityScore(period, builderActualsFromInputs(inputs))
}

function builderSignals(inputs: BuilderInputs, period: Period) {
  const actuals = builderActualsFromInputs(inputs)
  const window = periodToWindowKey(period)
  const windowDays = windowLengthDays(period)

  return BUILDER_ACTIVITY_SIGNALS.map(sig => {
    const target = sig.targets[window]
    const ratio = computeSignalRatio(sig.label, window, actuals, windowDays, target)
    return {
      label: sig.displayLabel,
      level: toLevel(ratio),
      pct: Math.round(ratio * 100),
    }
  })
}

export function calcBuilderGrade(stats: GitHubStats, period: Period): BuilderGrade {
  const current = builderInputsFromStats(stats, period, 'current')
  const pct = calcBuilderPct(current, period)
  const letter = pctToLetter(pct)

  if (period === '60d') {
    return {
      letter,
      pct,
      priorPct: null,
      trendPct: null,
      trend: 'flat',
      summary: builderActivitySummary(pct),
      signals: builderSignals(current, period),
    }
  }

  const prior = builderInputsFromStats(stats, period, 'prior')
  const priorPct = calcBuilderPct(prior, period)
  const trendPct = pctChange(pct, priorPct)

  return {
    letter,
    pct,
    priorPct,
    trendPct,
    trend: trendFromPct(trendPct),
    summary: builderActivitySummary(pct),
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
  if (period === '60d') {
    return window === 'current' ? live.commits30d + live.commits30_60 : 0
  }
  if (period === '30d') {
    return window === 'current' ? live.commits30d : live.commits30_60
  }
  return window === 'current' ? live.commits7d : live.commits7_14
}

function tokenMechanicTagCommitCounts(
  stats: GitHubStats,
  activeRepos: Repo[],
  period: Period,
  window: 'current' | 'prior',
) {
  const counts = { direct: 0, lock: 0, indirect: 0, infra: 0 }
  for (const repo of activeRepos) {
    const w = commitsForRepo(stats, repo.githubSlug, period, window)
    if (w <= 0) continue
    if (repo.tag === 'direct') counts.direct += w
    else if (repo.tag === 'supply-lock') counts.lock += w
    else if (repo.tag === 'indirect') counts.indirect += w
    else counts.infra += w
  }
  return counts
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
    if (period === '60d') {
      return window === 'current' ? live.commits30d + live.commits30_60 > 0 : false
    }
    if (period === '30d') {
      return window === 'current' ? live.commits30d > 0 : live.commits30_60 > 0
    }
    return window === 'current' ? live.commits7d > 0 : live.commits7_14 > 0
  })
}

function reposWithScoredTokenMechanic(repos: Repo[]): Repo[] {
  return repos.filter(r => isConsumerEconomicScored(r))
}

function tokenMechanicRubricCommitCounts(
  stats: GitHubStats,
  repos: Repo[],
  period: Period,
) {
  let high = 0
  let mid = 0
  let low = 0
  let total = 0
  for (const repo of repos) {
    const pct = getConsumerEconomicScorePct(repo)
    if (pct == null) continue
    const w = commitsForRepo(stats, repo.githubSlug, period, 'current')
    if (w <= 0) continue
    total += w
    if (pct >= 80) high += w
    else if (pct >= 60) mid += w
    else low += w
  }
  return { high, mid, low, commitWeight: total, repos: repos.length }
}

function biRubricLevelScore(repo: Repo, labels: string[]): number {
  for (const label of labels) {
    const row = repo.builderIntegrity.rubric.find(x => x.label === label)
    if (row) {
      return row.level === 'high' ? 100 : row.level === 'mid' ? 67 : 33
    }
  }
  return 33
}

function tokenMechanicSummary(pct: number, period: Period): string {
  const window =
    period === '60d'
      ? 'over 60 days'
      : period === '30d'
        ? 'in this window'
        : 'this week'
  if (pct >= 80) {
    return period === '60d'
      ? 'Burn-app repos with the most commits over 60 days score strongly on token mechanic rubrics.'
      : `Burn-app repos with the most commits ${window} score strongly on token mechanic rubrics.`
  }
  if (pct >= 60) {
    return period === '60d'
      ? 'Heavy 60-day commit repos mostly show solid burn-app economic scores.'
      : `Heavy commit burn apps mostly show solid token mechanic scores ${window}.`
  }
  if (pct >= 40) {
    return period === '60d'
      ? 'Burn-app economic scores are mixed where commit volume landed over 60 days.'
      : `Burn-app economic scores are mixed where commit volume landed ${window}.`
  }
  return period === '60d'
    ? 'Most 60-day commits on burn apps landed on weaker token mechanic scores.'
    : `Most burn-app commits ${window} landed on weaker token mechanic scores.`
}

function calcTokenMechanicGradeUnified(stats: GitHubStats, repoSet: Repo[], period: Period): TokenMechanicGrade {
  const scored = reposWithScoredTokenMechanic(repoSet)
  const activeRepos = reposActiveInWindow(stats, scored, period, 'current')
  const priorActiveRepos = reposActiveInWindow(stats, scored, period, 'prior')
  const sample = activeRepos.length ? activeRepos : scored
  const priorSample = priorActiveRepos

  const pct = weightedAvgByCommits(stats, sample, period, 'current', r => getConsumerEconomicScorePct(r) ?? 0)
  const priorPct =
    period === '60d' || !priorSample.length
      ? null
      : weightedAvgByCommits(stats, priorSample, period, 'prior', r => getConsumerEconomicScorePct(r) ?? 0)
  const trendPct = period === '60d' ? null : pctChange(pct, priorPct ?? 0)

  const rubricCounts = tokenMechanicRubricCommitCounts(stats, sample, period)
  const weightBase = rubricCounts.commitWeight || 1

  const impactAvg = weightedAvgByCommits(stats, sample, period, 'current', r =>
    slRubricLevelScore(r, [SL_LABELS[0], TM_CONSUMER_LABELS[0], LEGACY_TM_LABELS[0]]),
  )
  const clarityAvg = weightedAvgByCommits(stats, sample, period, 'current', r =>
    slRubricLevelScore(r, [SL_LABELS[1], TM_CONSUMER_LABELS[1], LEGACY_TM_LABELS[1]]),
  )
  const alignmentAvg = weightedAvgByCommits(stats, sample, period, 'current', r =>
    slRubricLevelScore(r, [SL_LABELS[2], TM_CONSUMER_LABELS[2], LEGACY_TM_LABELS[2]]),
  )

  const tagCommits =
    period === '60d'
      ? undefined
      : tokenMechanicTagCommitCounts(stats, sample, period, 'current')

  return {
    counts: {
      direct: rubricCounts.high,
      lock: rubricCounts.mid,
      indirect: rubricCounts.low,
      infra: 0,
      repos: sample.length,
    },
    tagCommits,
    letter: pctToLetter(pct),
    pct,
    priorPct,
    trendPct,
    trend: period === '60d' ? 'flat' : trendFromPct(trendPct),
    summary: tokenMechanicSummary(pct, period),
    signals: [
      { label: 'CLAWD economic impact', level: toLevel(impactAvg / 100), pct: impactAvg },
      { label: 'Mechanism clarity', level: toLevel(clarityAvg / 100), pct: clarityAvg },
      { label: 'Economic alignment', level: toLevel(alignmentAvg / 100), pct: alignmentAvg },
      {
        label: 'High-TM share',
        level: toLevel(rubricCounts.high / weightBase),
        pct: Math.round((rubricCounts.high / weightBase) * 100),
      },
    ],
  }
}

export function calcTokenMechanicGrade(stats: GitHubStats, period: Period, repoSet: Repo[]): TokenMechanicGrade {
  return calcTokenMechanicGradeUnified(stats, repoSet, period)
}

function reposForEcosystemIntegrity(repos: Repo[]): Repo[] {
  return repos.filter(r => isEcosystemIntegritySample(r))
}

export function calcIntegrityGrade(stats: GitHubStats | null, period: Period, repoSet: Repo[]): IntegrityGrade {
  const integrityRepos = reposForEcosystemIntegrity(repoSet)
  const activeRepos = !stats
    ? integrityRepos
    : reposActiveInWindow(stats, integrityRepos, period, 'current')

  const priorActiveRepos = !stats
    ? integrityRepos
    : reposActiveInWindow(stats, integrityRepos, period, 'prior')

  const sample = activeRepos.length ? activeRepos : integrityRepos
  const priorSample = priorActiveRepos

  const pct = !stats
    ? avg(sample.map(repo => repo.builderIntegrity.pct))
    : weightedAvgByCommits(stats, sample, period, 'current', r => r.builderIntegrity.pct)

  const priorPct = !stats || !priorSample.length || period === '60d'
    ? 0
    : weightedAvgByCommits(stats, priorSample, period, 'prior', r => r.builderIntegrity.pct)

  const priorPctValue = period === '60d' ? null : priorPct
  const trendPct = period === '60d' ? null : pctChange(pct, priorPct)

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

  const rubricScore = (repo: Repo, labels: string[]) => biRubricLevelScore(repo, labels)

  const onChainAvg = stats
    ? weightedAvgByCommits(stats, sample, period, 'current', r =>
        rubricScore(r, [BI_ROW_LABELS[0], LEGACY_BI_LABELS[0]]),
      )
    : avg(sample.map(r => rubricScore(r, [BI_ROW_LABELS[0], LEGACY_BI_LABELS[0]])))

  const safetyAvg = stats
    ? weightedAvgByCommits(stats, sample, period, 'current', r =>
        rubricScore(r, [BI_ROW_LABELS[1], LEGACY_BI_LABELS[1]]),
      )
    : avg(sample.map(r => rubricScore(r, [BI_ROW_LABELS[1], LEGACY_BI_LABELS[1]])))

  const transparencyAvg = stats
    ? weightedAvgByCommits(stats, sample, period, 'current', r =>
        rubricScore(r, [BI_ROW_LABELS[2], LEGACY_BI_LABELS[2]]),
      )
    : avg(sample.map(r => rubricScore(r, [BI_ROW_LABELS[2], LEGACY_BI_LABELS[2]])))

  return {
    counts: { active: sample.length, high, mid, low, commitWeight },
    letter: pctToLetter(pct),
    pct,
    priorPct: priorPctValue,
    trendPct,
    trend: period === '60d' ? 'flat' : trendFromPct(trendPct),
    summary:
      period === '60d'
        ? pct >= 80
          ? 'Repos seeing the most commits over 60 days score strongly on the builder-values rubric.'
          : pct >= 60
            ? 'Heavy 60-day commit repos mostly fit the stated builder-values frame.'
            : pct >= 40
              ? 'Integrity is mixed across where commit volume landed over 60 days.'
              : 'Most 60-day commits landed on repos with weaker builder-values scores.'
        : pct >= 80
        ? 'Repos seeing the most commits score strongly on the builder-values rubric.'
        : pct >= 60
          ? 'Heavy commit repos mostly fit the stated builder-values frame, with some weaker alignment.'
          : pct >= 40
            ? 'Integrity is mixed across where commit volume landed this window.'
            : 'Most commits this window landed on repos with weaker builder-values scores.',
    signals: [
      { label: 'On-chain commitments', level: toLevel(onChainAvg / 100), pct: onChainAvg },
      { label: 'User safety', level: toLevel(safetyAvg / 100), pct: safetyAvg },
      { label: 'Transparency', level: toLevel(transparencyAvg / 100), pct: transparencyAvg },
      { label: 'High-integrity share', level: toLevel(high / weightBase), pct: Math.round((high / weightBase) * 100) },
    ],
  }
}

export function formatTrendPct(trendPct: number | null, period: Period): string {
  if (period === '60d') return ''
  const windowLabel = period === '30d' ? 'prior 30d' : 'prior 7d'
  if (trendPct === null) return `new vs ${windowLabel}`
  if (trendPct > 0) return `+${trendPct}% vs ${windowLabel}`
  if (trendPct < 0) return `${trendPct}% vs ${windowLabel}`
  return `0% vs ${windowLabel}`
}
