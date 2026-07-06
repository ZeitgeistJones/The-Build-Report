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
import { BI_ROW_LABELS } from './rubrics/builderIntegrity'
import {
  LEGACY_TM_LABELS,
  TM_CONSUMER_LABELS,
} from './rubrics/tokenMechanic'
import {
  SL_LABELS,
  slRubricLevelScore,
} from './rubrics/shippingLeverage'
import { getConsumerEconomicScorePct, isConsumerEconomicScored } from './economicGrade'
import type { GradeNewArrival } from './gradeNewArrivals'
import type { PathToCHint } from './gradePathToC'

export { pctToLetter }

/** Map numeric score (0–100) to letter grade. Delegates to {@link pctToLetter}. */
export function letterGrade(pct: number): string {
  return pctToLetter(pct)
}

export type Period = '24h' | '7d' | '30d' | '60d'

/** Extended period for repo list filtering — includes prior comparison windows. */
export type PeriodKey = Period | '7d-prior' | '30d-prior'

/** Grades panel — current windows only. */
export const GRADES_PERIOD_TOGGLE_OPTIONS: { key: Period; label: string; short: string }[] = [
  { key: '24h', label: 'Last 24 hours', short: '24h' },
  { key: '7d', label: 'Last 7 days', short: '7d' },
  { key: '30d', label: 'Last 30 days', short: '30d' },
  { key: '60d', label: 'Last 60 days', short: '60d' },
]

/** @deprecated Use GRADES_PERIOD_TOGGLE_OPTIONS — prior windows hidden from UI. */
export const PERIOD_TOGGLE_OPTIONS: { key: PeriodKey; label: string; short: string }[] = [
  ...GRADES_PERIOD_TOGGLE_OPTIONS,
  { key: '7d-prior', label: 'Prior 7 days (8–14)', short: '7d prev' },
  { key: '30d-prior', label: 'Prior 30 days (31–60)', short: '30d prev' },
]

/** Repo list window — current periods only. */
export const REPO_WINDOW_OPTIONS = GRADES_PERIOD_TOGGLE_OPTIONS

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
    commits24h?: number | null
    commits7d?: number | null
    commits7_14?: number | null
    commits30d?: number | null
    commits30_60?: number | null
    commitsScanned?: boolean | null
  },
  pk: PeriodKey,
): number | null {
  if (repo.commitsScanned === false) return null

  switch (pk) {
    case '24h':
      return repo.commits24h ?? null
    case '7d':
      return repo.commits7d ?? null
    case '7d-prior':
      return repo.commits7_14 ?? null
    case '30d':
      return repo.commits30d ?? null
    case '30d-prior':
      return repo.commits30_60 ?? null
    case '60d':
      if (repo.commits30d == null && repo.commits30_60 == null) return null
      return (repo.commits30d ?? 0) + (repo.commits30_60 ?? 0)
  }
}

export interface TrendExplanation {
  headline: string
  bullets: string[]
}

export type TrendDirection = 'up' | 'flat' | 'down' | 'new'

export interface BuilderGrade {
  letter: string
  pct: number
  priorPct: number | null
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: TrendDirection
  trendExplanation?: TrendExplanation
}

export interface TokenMechanicGrade {
  counts: { high: number; mid: number; low: number; repos: number }
  tagCommits?: { direct: number; lock: number; indirect: number; infra: number }
  /** Share of ecosystem commits on holder-facing repos (direct, lock, indirect). */
  holderCoveragePct?: number | null
  /** TM quality before holder-attention coverage adjustment. */
  qualityPct?: number | null
  letter: string
  pct: number
  priorPct: number | null
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: TrendDirection
  trendExplanation?: TrendExplanation
  newArrivals?: GradeNewArrival[]
}

export interface IntegrityDragRepo {
  name: string
  slug: string
  pct: number
  commits: number
}

export interface IntegrityGrade {
  counts: { active: number; high: number; mid: number; low: number; commitWeight: number }
  dragRepos?: IntegrityDragRepo[]
  letter: string
  pct: number
  priorPct: number | null
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trendPct: number | null
  trend: TrendDirection
  trendExplanation?: TrendExplanation
  newArrivals?: GradeNewArrival[]
  pathToC?: PathToCHint | null
}

/** Relative % change for display ("+12% vs prior"). Null when prior is 0 and current > 0 ("new"). */
export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? null : 0
  return Math.round(((curr - prev) / prev) * 100)
}

/**
 * Trend direction decided on an ABSOLUTE point band (flat within +/-3 points), so low and high
 * scores flip on the same real movement. `prev === null` means no prior window (e.g. 60d).
 */
export function trendDirection(curr: number, prev: number | null): TrendDirection {
  if (prev === null) return 'new'
  if (prev === 0) return curr > 0 ? 'new' : 'flat'
  const delta = curr - prev
  if (delta > 3) return 'up'
  if (delta < -3) return 'down'
  return 'flat'
}

/** @deprecated Use {@link trendDirection} — decides on absolute points and surfaces the 'new' state. */
export function trendFromPct(change: number | null): TrendDirection {
  if (change === null) return 'new'
  if (change > 3) return 'up'
  if (change < -3) return 'down'
  return 'flat'
}

function toLevel(pct: number): 'high' | 'mid' | 'low' {
  if (pct >= 0.75) return 'high'
  if (pct >= 0.42) return 'mid'
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
      r => (r.commits30d ?? 0) + (r.commits30_60 ?? 0) > 0,
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

  if (period === '30d') {
    const activeRepos = Object.values(stats.repoActivity).filter(r =>
      window === 'current' ? (r.commits30d ?? 0) > 0 : (r.commits30_60 ?? 0) > 0,
    ).length
    return {
      commits: window === 'current' ? stats.totalCommits30d : stats.totalCommits30_60,
      activeDays: window === 'current' ? stats.activeDays30d : stats.activeDays30_60,
      newRepos: window === 'current' ? stats.newRepos30d : stats.newRepos30_60,
      activeRepos,
      scannedRepos: activityCount,
      periodDays: 30,
    }
  }

  if (period === '24h') {
    const activeRepos = Object.values(stats.repoActivity).filter(r =>
      window === 'current' ? (r.commits24h ?? 0) > 0 : (r.commits24_48 ?? 0) > 0,
    ).length
    return {
      commits: window === 'current' ? (stats.totalCommits24h ?? 0) : (stats.totalCommits24_48 ?? 0),
      activeDays: window === 'current' ? (stats.activeDays24h ?? 0) : (stats.activeDays24_48 ?? 0),
      newRepos: window === 'current' ? (stats.newRepos24h ?? 0) : (stats.newRepos24_48 ?? 0),
      activeRepos,
      scannedRepos: activityCount,
      periodDays: 1,
    }
  }

  const activeRepos = Object.values(stats.repoActivity).filter(r =>
    window === 'current' ? (r.commits7d ?? 0) > 0 : (r.commits7_14 ?? 0) > 0,
  ).length
  return {
    commits: window === 'current' ? stats.totalCommits7d : stats.totalCommits7_14,
    activeDays: window === 'current' ? stats.activeDays7d : stats.activeDays7_14,
    newRepos: window === 'current' ? stats.newRepos7d : stats.newRepos7_14,
    activeRepos,
    scannedRepos: activityCount,
    periodDays: 7,
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
    trend: trendDirection(pct, priorPct),
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
    return window === 'current'
      ? (live.commits30d ?? 0) + (live.commits30_60 ?? 0)
      : 0
  }
  if (period === '30d') {
    return window === 'current' ? (live.commits30d ?? 0) : (live.commits30_60 ?? 0)
  }
    if (period === '24h') {
      return window === 'current' ? (live.commits24h ?? 0) : (live.commits24_48 ?? 0)
    }
  return window === 'current' ? (live.commits7d ?? 0) : (live.commits7_14 ?? 0)
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

/** No single repo may exceed this share of total commit weight, so one hot repo can't capture a grade. */
const MAX_SINGLE_REPO_WEIGHT_SHARE = 0.5

/**
 * Commit weights per repo with a single-repo cap applied: no repo contributes more than
 * {@link MAX_SINGLE_REPO_WEIGHT_SHARE} of the total. Preserves "grade follows the work" while
 * preventing one repo shipping the bulk of a window's commits from being the entire grade.
 */
function cappedCommitWeights(
  stats: GitHubStats,
  repos: Repo[],
  period: Period,
  window: 'current' | 'prior',
): { repo: Repo; weight: number }[] {
  const raw = repos
    .map(repo => ({ repo, weight: commitsForRepo(stats, repo.githubSlug, period, window) }))
    .filter(r => r.weight > 0)
  if (raw.length <= 1) return raw

  const total = raw.reduce((s, r) => s + r.weight, 0)
  const cap = total * MAX_SINGLE_REPO_WEIGHT_SHARE
  return raw.map(r => ({ repo: r.repo, weight: Math.min(r.weight, cap) }))
}

/**
 * Commit-weighted average, but on a quiet window (no commit weight) falls back to an unweighted
 * average of the sample's scores. Prevents a no-commits window collapsing a grade to 0 (F-)
 * when the underlying quality is unchanged.
 */
function weightedOrFlatAvg(
  stats: GitHubStats,
  repos: Repo[],
  period: Period,
  window: 'current' | 'prior',
  scoreFn: (repo: Repo) => number,
): number {
  let sum = 0
  let weight = 0
  for (const { repo, weight: w } of cappedCommitWeights(stats, repos, period, window)) {
    sum += scoreFn(repo) * w
    weight += w
  }
  if (weight > 0) return Math.round(sum / weight)
  return avg(repos.map(scoreFn))
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
      return window === 'current'
        ? (live.commits30d ?? 0) + (live.commits30_60 ?? 0) > 0
        : false
    }
    if (period === '30d') {
      return window === 'current'
        ? (live.commits30d ?? 0) > 0
        : (live.commits30_60 ?? 0) > 0
    }
    if (period === '24h') {
      return window === 'current' ? (live.commits24h ?? 0) > 0 : (live.commits24_48 ?? 0) > 0
    }
    return window === 'current'
      ? (live.commits7d ?? 0) > 0
      : (live.commits7_14 ?? 0) > 0
  })
}

function reposWithScoredTokenMechanic(repos: Repo[]): Repo[] {
  return repos.filter(r => isConsumerEconomicScored(r))
}

export function consumerEconomicRepos(repos: Repo[]): Repo[] {
  return reposWithScoredTokenMechanic(repos)
}

/** Soft multiplier when holder-facing work is a small share of total commits. */
function holderCoverageMultiplier(coverageRatio: number): number {
  return 0.35 + 0.65 * Math.min(1, coverageRatio / 0.2)
}

function holderCoveragePctFromTags(
  tagCommits: { direct: number; lock: number; indirect: number; infra: number } | undefined,
): number | null {
  if (!tagCommits) return null
  const holder = tagCommits.direct + tagCommits.lock + tagCommits.indirect
  const total = holder + tagCommits.infra
  if (total <= 0) return null
  return Math.round((holder / total) * 100)
}

function integrityDragRepos(
  stats: GitHubStats,
  repos: Repo[],
  period: Period,
  limit = 3,
): IntegrityDragRepo[] {
  return repos
    .map(repo => {
      if (repo.builderIntegrity.letter === '—') return null
      const commits = commitsForRepo(stats, repo.githubSlug, period, 'current')
      if (commits <= 0) return null
      const drag = commits * (100 - repo.builderIntegrity.pct)
      return {
        name: repo.name,
        slug: repo.githubSlug,
        pct: repo.builderIntegrity.pct,
        commits,
        drag,
      }
    })
    .filter((r): r is IntegrityDragRepo & { drag: number } => r != null)
    .sort((a, b) => b.drag - a.drag)
    .slice(0, limit)
    .map(({ drag: _drag, ...rest }) => rest)
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
        : period === '24h'
          ? 'in the last 24 hours'
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
  // B3: prior window uses the same fallback sample + quiet-safe average as the current window,
  // so a quiet prior period reads 'flat' (unchanged quality) instead of a phantom 'new'/collapse.
  const priorSample = priorActiveRepos.length ? priorActiveRepos : scored

  const qualityPct = weightedOrFlatAvg(stats, sample, period, 'current', r => getConsumerEconomicScorePct(r) ?? 0)
  const priorQualityPct =
    period === '60d' || !priorSample.length
      ? null
      : weightedOrFlatAvg(stats, priorSample, period, 'prior', r => getConsumerEconomicScorePct(r) ?? 0)

  const ecosystemTags =
    period === '60d' ? undefined : tokenMechanicTagCommitCounts(stats, repoSet, period, 'current')
  const priorEcosystemTags =
    period === '60d' ? undefined : tokenMechanicTagCommitCounts(stats, repoSet, period, 'prior')
  const holderCoveragePct = holderCoveragePctFromTags(ecosystemTags)

  let pct = qualityPct
  let priorPct = priorQualityPct
  if (holderCoveragePct != null && period !== '60d') {
    const ratio = holderCoveragePct / 100
    const mult = holderCoverageMultiplier(ratio)
    pct = Math.round(qualityPct * mult)
    if (priorQualityPct != null && priorEcosystemTags) {
      const priorHolderPct = holderCoveragePctFromTags(priorEcosystemTags)
      if (priorHolderPct != null) {
        priorPct = Math.round(priorQualityPct * holderCoverageMultiplier(priorHolderPct / 100))
      }
    }
  }

  const trendPct = period === '60d' ? null : pctChange(pct, priorPct ?? 0)

  const rubricCounts = tokenMechanicRubricCommitCounts(stats, sample, period)
  const weightBase = rubricCounts.commitWeight || 1

  const impactAvg = weightedOrFlatAvg(stats, sample, period, 'current', r =>
    slRubricLevelScore(r, [SL_LABELS[0], TM_CONSUMER_LABELS[0], LEGACY_TM_LABELS[0]]),
  )
  const clarityAvg = weightedOrFlatAvg(stats, sample, period, 'current', r =>
    slRubricLevelScore(r, [SL_LABELS[1], TM_CONSUMER_LABELS[1], LEGACY_TM_LABELS[1]]),
  )
  const alignmentAvg = weightedOrFlatAvg(stats, sample, period, 'current', r =>
    slRubricLevelScore(r, [SL_LABELS[2], TM_CONSUMER_LABELS[2], LEGACY_TM_LABELS[2]]),
  )

  const tagCommits =
    period === '60d'
      ? undefined
      : tokenMechanicTagCommitCounts(stats, sample, period, 'current')

  return {
    counts: {
      high: rubricCounts.high,
      mid: rubricCounts.mid,
      low: rubricCounts.low,
      repos: sample.length,
    },
    tagCommits,
    holderCoveragePct,
    qualityPct: period === '60d' ? null : qualityPct,
    letter: pctToLetter(pct),
    pct,
    priorPct,
    trendPct,
    trend: period === '60d' ? 'flat' : trendDirection(pct, priorPct),
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

/**
 * Ecosystem integrity now spans all tags. Infra/indirect/theoretical are scored on
 * infra-appropriate integrity criteria (BI_SHIPPING_LEVERAGE_RULES), so the old "unfair yardstick"
 * reason to exclude them is gone — including them keeps Builder Integrity from diverging from a
 * heavy infra week that already moves Builder Activity. Infra stays out of Token Mechanic only.
 */
function reposForEcosystemIntegrity(repos: Repo[]): Repo[] {
  return repos
}

export function calcIntegrityGrade(stats: GitHubStats | null, period: Period, repoSet: Repo[]): IntegrityGrade {
  const integrityRepos = reposForEcosystemIntegrity(repoSet).filter(
    r => r.builderIntegrity.letter !== '—',
  )
  const activeRepos = !stats
    ? integrityRepos
    : reposActiveInWindow(stats, integrityRepos, period, 'current')

  const priorActiveRepos = !stats
    ? integrityRepos
    : reposActiveInWindow(stats, integrityRepos, period, 'prior')

  const sample = activeRepos.length ? activeRepos : integrityRepos
  // B3: prior window uses the same fallback sample + quiet-safe average as the current window,
  // so a quiet prior period reads 'flat' (unchanged quality) instead of a phantom 'new'/collapse.
  const priorSample = priorActiveRepos.length ? priorActiveRepos : integrityRepos

  const pct = !stats
    ? avg(sample.map(repo => repo.builderIntegrity.pct))
    : weightedOrFlatAvg(stats, sample, period, 'current', r => r.builderIntegrity.pct)

  const hasPrior = Boolean(stats) && priorSample.length > 0 && period !== '60d'
  const priorPct = hasPrior
    ? weightedOrFlatAvg(stats!, priorSample, period, 'prior', r => r.builderIntegrity.pct)
    : null

  const priorPctValue = priorPct
  const trendPct = period === '60d' ? null : pctChange(pct, priorPct ?? 0)

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
  const dragRepos = stats ? integrityDragRepos(stats, sample, period) : undefined

  // v5 integrity signals: average each of the 5 real rubric rows over ONLY the repos that
  // actually have that row (v5-scored). No positional fallback onto legacy 3-row labels —
  // a legacy "Serves stated vision" row is not "On-chain commitments" and must not masquerade
  // as one. Legacy repos still drive the overall pct/counts; they just don't fake v5 signals.
  const v5SignalAvg = (label: string): { pct: number; count: number } => {
    const contributors = sample.filter(r =>
      r.builderIntegrity.rubric.some(row => row.label === label),
    )
    if (!contributors.length) return { pct: 0, count: 0 }
    return {
      pct: Math.round(avg(contributors.map(r => biRubricLevelScore(r, [label])))),
      count: contributors.length,
    }
  }

  const V5_SIGNAL_LABELS: { row: string; display: string }[] = [
    { row: BI_ROW_LABELS[0], display: 'On-chain commitments' },
    { row: BI_ROW_LABELS[1], display: 'User safety' },
    { row: BI_ROW_LABELS[2], display: 'Transparency' },
    { row: BI_ROW_LABELS[3], display: 'Governance & alignment' },
    { row: BI_ROW_LABELS[4], display: 'Security & testing' },
  ]

  const v5Signals = V5_SIGNAL_LABELS.map(({ row, display }) => ({
    display,
    ...v5SignalAvg(row),
  }))
    .filter(s => s.count > 0)
    .map(s => ({ label: s.display, level: toLevel(s.pct / 100), pct: s.pct }))

  return {
    counts: { active: sample.length, high, mid, low, commitWeight },
    dragRepos,
    letter: pctToLetter(pct),
    pct,
    priorPct: priorPctValue,
    trendPct,
    trend: period === '60d' ? 'flat' : trendDirection(pct, priorPct),
    summary:
      period === '60d'
        ? pct >= 80
          ? 'Repos seeing the most commits over 60 days score strongly on the builder-standards rubric.'
          : pct >= 60
            ? 'Heavy 60-day commit repos mostly fit the builder-standards frame.'
            : pct >= 40
              ? 'Standards scores are mixed across where commit volume landed over 60 days.'
              : 'Most 60-day commits landed on repos with weaker builder-standards scores.'
        : pct >= 80
        ? 'Repos seeing the most commits score strongly on the builder-standards rubric.'
        : pct >= 60
          ? 'Heavy commit repos mostly fit the builder-standards frame, with some weaker rubric rows.'
          : pct >= 40
            ? 'Standards scores are mixed across where commit volume landed this window.'
            : 'Most commits this window landed on repos with weaker builder-standards scores.',
    signals: [
      ...v5Signals,
      { label: 'High-standards share', level: toLevel(high / weightBase), pct: Math.round((high / weightBase) * 100) },
    ],
  }
}

export function formatTrendPct(trendPct: number | null, period: Period): string {
  if (period === '60d') return ''
  const windowLabel =
    period === '30d' ? 'prior 30d' : period === '24h' ? 'prior 24h' : 'prior 7d'
  if (trendPct === null) return `new vs ${windowLabel}`
  if (trendPct > 0) return `+${trendPct}% vs ${windowLabel}`
  if (trendPct < 0) return `${trendPct}% vs ${windowLabel}`
  return `steady vs ${windowLabel}`
}
