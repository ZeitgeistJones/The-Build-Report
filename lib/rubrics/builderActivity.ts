import type { Period } from '@/lib/grades'

export type ActivityWindowKey = '24h' | '7d' | '30d' | '60d'

export interface ActivitySignalConfig {
  label: string
  displayLabel: string
  weight: number
  targets: Record<ActivityWindowKey, number>
}

// Interim fixed targets — follow-up: rolling-baseline targets (median of trailing N windows)
// stored in Redis alongside the daily snapshot.
export const BUILDER_ACTIVITY_SIGNALS: ActivitySignalConfig[] = [
  {
    label: 'totalCommits',
    displayLabel: 'Total commits',
    weight: 20,
    targets: { '24h': 17, '7d': 120, '30d': 500, '60d': 900 },
  },
  {
    label: 'activeDays',
    displayLabel: 'Active days',
    weight: 20,
    targets: { '24h': 1, '7d': 5, '30d': 15, '60d': 24 },
  },
  {
    label: 'newRepos',
    displayLabel: 'New repos created',
    weight: 20,
    targets: { '24h': 1, '7d': 1, '30d': 4, '60d': 8 },
  },
  {
    label: 'reposWithCommits',
    displayLabel: 'Repos with commits',
    weight: 20,
    targets: { '24h': 2, '7d': 14, '30d': 34, '60d': 40 },
  },
  {
    label: 'commitConsistency',
    displayLabel: 'Longest dry spell',
    weight: 20,
    targets: { '24h': 1.0, '7d': 0.7, '30d': 0.5, '60d': 0.4 },
  },
]

export interface BuilderActivityActuals {
  totalCommits: number
  activeDays: number
  newRepos: number
  reposWithCommits: number
  /** Longest calendar-day gap without commits in the window (incl. edges). */
  longestInactiveGapDays: number
}

export function periodToWindowKey(period: Period): ActivityWindowKey {
  return period
}

export function windowLengthDays(period: Period): number {
  if (period === '60d') return 60
  if (period === '30d') return 30
  if (period === '24h') return 1
  return 7
}

function calendarDayDiff(startDay: string, endDay: string): number {
  const start = new Date(`${startDay}T00:00:00Z`).getTime()
  const end = new Date(`${endDay}T00:00:00Z`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

/** Longest inactive stretch in a rolling window (days without any commit). */
export function computeLongestInactiveGapDays(activeDayDates: string[], windowDays: number): number {
  if (windowDays <= 0) return 0
  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - windowDays * 86_400_000)
  const windowStartDay = windowStart.toISOString().slice(0, 10)
  const windowEndDay = windowEnd.toISOString().slice(0, 10)

  const days = [...new Set(activeDayDates)]
    .filter(d => d >= windowStartDay && d <= windowEndDay)
    .sort()

  if (!days.length) return windowDays

  let maxGap = calendarDayDiff(windowStartDay, days[0]!)
  for (let i = 1; i < days.length; i++) {
    const between = calendarDayDiff(days[i - 1]!, days[i]!) - 1
    if (between > maxGap) maxGap = between
  }
  const tailGap = calendarDayDiff(days[days.length - 1]!, windowEndDay)
  return Math.max(maxGap, tailGap, 0)
}

export function computeSignalRatio(
  label: string,
  window: ActivityWindowKey,
  actuals: BuilderActivityActuals,
  windowDays: number,
  target: number,
): number {
  if (label === 'commitConsistency') {
    const gapRatio = actuals.longestInactiveGapDays / windowDays
    if (gapRatio <= 0) return 1
    if (target <= 0) return 0
    return Math.min(target / gapRatio, 1)
  }

  const actualMap: Record<string, number> = {
    totalCommits: actuals.totalCommits,
    activeDays: actuals.activeDays,
    newRepos: actuals.newRepos,
    reposWithCommits: actuals.reposWithCommits,
  }
  const actual = actualMap[label] ?? 0
  if (target <= 0) return 0
  return Math.min(actual / target, 1)
}

export function computeBuilderActivityScore(
  period: Period,
  actuals: BuilderActivityActuals,
): number {
  const window = periodToWindowKey(period)
  const windowDays = windowLengthDays(period)
  let total = 0

  for (const sig of BUILDER_ACTIVITY_SIGNALS) {
    const target = sig.targets[window]
    const ratio = computeSignalRatio(sig.label, window, actuals, windowDays, target)
    total += ratio * sig.weight
  }

  return Math.round(total)
}

export function builderActivitySummary(pct: number): string {
  if (pct >= 80) {
    return 'The builder is actively shipping across the ecosystem this period, with frequent commits and consistent work across many repos.'
  }
  if (pct >= 60) {
    return 'The builder is shipping reliably, with steady commits and healthy repo coverage, though not at peak burst levels.'
  }
  if (pct >= 40) {
    return 'Builder activity is present but uneven this period — some days and repos see action, but overall shipping pace is moderate.'
  }
  return "The builder's GitHub activity is light this period, with few commits or active repos relative to typical ecosystem output."
}
