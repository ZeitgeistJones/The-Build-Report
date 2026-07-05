import type { Period } from '@/lib/grades'

export type ActivityWindowKey = '7d' | '30d' | '60d'

export interface ActivitySignalConfig {
  label: string
  displayLabel: string
  weight: number
  targets: Record<ActivityWindowKey, number>
}

// Targets raised to match this agent's observed output (~480 commits/30d) so signals aren't
// permanently pinned at max. Interim fix — the honest long-term solution is a rolling baseline
// (target = median of trailing windows); tracked as a follow-up since it needs stored history.
export const BUILDER_ACTIVITY_SIGNALS: ActivitySignalConfig[] = [
  {
    label: 'totalCommits',
    displayLabel: 'Total commits',
    weight: 20,
    targets: { '7d': 120, '30d': 500, '60d': 900 },
  },
  {
    label: 'activeDays',
    displayLabel: 'Active days',
    weight: 20,
    targets: { '7d': 7, '30d': 30, '60d': 55 },
  },
  {
    label: 'newRepos',
    displayLabel: 'New repos created',
    weight: 20,
    targets: { '7d': 1, '30d': 4, '60d': 8 },
  },
  {
    label: 'reposWithCommits',
    displayLabel: 'Repos with commits',
    weight: 20,
    targets: { '7d': 14, '30d': 34, '60d': 40 },
  },
  {
    label: 'commitConsistency',
    displayLabel: 'Commit consistency',
    weight: 20,
    targets: { '7d': 0.7, '30d': 0.5, '60d': 0.4 },
  },
]

export interface BuilderActivityActuals {
  totalCommits: number
  activeDays: number
  newRepos: number
  reposWithCommits: number
}

export function periodToWindowKey(period: Period): ActivityWindowKey {
  return period
}

export function windowLengthDays(period: Period): number {
  return period === '60d' ? 60 : period === '30d' ? 30 : 7
}

export function computeSignalRatio(
  label: string,
  window: ActivityWindowKey,
  actuals: BuilderActivityActuals,
  windowDays: number,
  target: number,
): number {
  if (label === 'commitConsistency') {
    const ratio = actuals.activeDays / windowDays
    return Math.min(ratio / target, 1)
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
