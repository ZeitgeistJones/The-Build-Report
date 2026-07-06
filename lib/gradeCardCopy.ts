import type {
  BuilderGrade,
  IntegrityGrade,
  Period,
  TokenMechanicGrade,
  TrendDirection,
  TrendExplanation,
} from '@/lib/grades'

export type GradeCardId = 'builder' | 'economic' | 'integrity'

export interface GradeCardFace {
  hook: string
  insights: string[]
}

type Signal = { label: string; level: 'high' | 'mid' | 'low'; pct: number }

function letterTier(letter: string): 'top' | 'solid' | 'mixed' | 'weak' {
  const head = letter.charAt(0)
  if (head === 'A') return 'top'
  if (head === 'B') return 'solid'
  if (head === 'C') return 'mixed'
  return 'weak'
}

function trendWord(trend: TrendDirection): string {
  if (trend === 'up') return 'up'
  if (trend === 'down') return 'down'
  if (trend === 'new') return 'new'
  return 'flat'
}

function builderHook(pct: number, letter: string, trend: TrendDirection): string {
  const tier = letterTier(letter)
  if (tier === 'top') {
    if (trend === 'up') return 'Shipping machine — and still accelerating.'
    if (trend === 'down') return 'Elite output this window, just off the sprint high.'
    return 'The forge is hot. Repos are moving daily.'
  }
  if (tier === 'solid') {
    if (trend === 'up') return 'Healthy rhythm — more repos picking up steam.'
    if (trend === 'down') return 'Steady builder, but the pace eased vs last window.'
    return 'Reliable shipping — not peak burst, not quiet.'
  }
  if (tier === 'mixed') {
    if (trend === 'up') return 'Activity is uneven, but trending in the right direction.'
    return 'Some days ship hard; overall pace is moderate.'
  }
  if (trend === 'up') return 'Light window, but momentum is building.'
  if (pct < 25) return 'Quiet period — few commits landed on tracked repos.'
  return 'GitHub activity is thin this window.'
}

function economicHook(pct: number, letter: string, trend: TrendDirection): string {
  const tier = letterTier(letter)
  if (tier === 'top') {
    if (trend === 'up') return 'Burn-app work is scoring stronger where commits landed.'
    return 'Holder-facing repos with commits look economically sound.'
  }
  if (tier === 'solid') {
    if (trend === 'down') return 'Solid burn path, but commit weight shifted to weaker TM scores.'
    return 'Burn mechanics hold up — room to sharpen the holder story.'
  }
  if (tier === 'mixed') {
    return 'Mixed token-mechanic picture where the work actually happened.'
  }
  if (trend === 'down') return 'Most commits this window landed on weaker burn-app rubrics.'
  if (pct < 30) return 'Little burn-app quality in the commit mix this period.'
  return 'Economic scores lag where shipping concentrated.'
}

function integrityHook(pct: number, letter: string, trend: TrendDirection): string {
  const tier = letterTier(letter)
  if (tier === 'top') {
    if (trend === 'up') return 'Trust is climbing — work landed on aligned repos.'
    return 'Heavy commits mostly hit repos that walk the talk.'
  }
  if (tier === 'solid') {
    if (trend === 'down') return 'Mostly aligned, but more weight on mid-tier repos lately.'
    return 'Values mostly match the work — a few soft spots.'
  }
  if (tier === 'mixed') {
    if (trend === 'down') return 'Integrity is split — commit volume didn’t follow the strongest repos.'
    return 'Trust is mixed across where commits landed.'
  }
  if (trend === 'down') return 'Trust gap — most commit weight landed on shakier repos.'
  if (pct < 45) return 'Low-integrity commits dominated this window.'
  return 'Builder-values alignment needs attention where work happened.'
}

function signalInsights(signals: Signal[], max = 2): string[] {
  if (!signals.length) return []
  const sorted = [...signals].sort((a, b) => b.pct - a.pct)
  const out: string[] = []
  const strongest = sorted[0]
  const weakest = sorted[sorted.length - 1]

  if (strongest.pct >= 65) {
    out.push(`Strongest: ${strongest.label.toLowerCase()} (${strongest.pct}%).`)
  }
  if (weakest.pct < 55 && weakest.label !== strongest.label) {
    out.push(`Weakest: ${weakest.label.toLowerCase()} (${weakest.pct}%).`)
  }
  return out.slice(0, max)
}

function trendInsight(explanation: TrendExplanation | undefined, period: Period): string | null {
  if (period === '60d' || !explanation?.bullets.length) return null
  return explanation.bullets[0] ?? null
}

function commitMixInsight(
  high: number,
  mid: number,
  low: number,
  weight: number,
  label: string,
): string | null {
  if (weight <= 0) return null
  const lowShare = Math.round((low / weight) * 100)
  const highShare = Math.round((high / weight) * 100)
  if (lowShare >= 50) {
    return `${lowShare}% of weighted commits landed on low-${label} repos.`
  }
  if (highShare >= 50) {
    return `${highShare}% of weighted commits on high-${label} repos.`
  }
  if (mid > high && mid > low) {
    return `Mid-tier ${label} repos carried most of the commit weight.`
  }
  return null
}

export function builderCardFace(
  grade: BuilderGrade,
  period: Period,
  stats?: { commits: number; activeDays: number; newRepos: number } | null,
): GradeCardFace {
  const hook = builderHook(grade.pct, grade.letter, grade.trend)
  const insights: string[] = []

  const trendLine = trendInsight(grade.trendExplanation, period)
  if (trendLine) insights.push(trendLine)

  insights.push(...signalInsights(grade.signals))

  if (stats && stats.newRepos >= 3 && insights.length < 2) {
    insights.push(`${stats.newRepos} new repos spun up — ecosystem footprint is expanding.`)
  } else if (stats && stats.activeDays >= 25 && insights.length < 2) {
    insights.push(`Active ${stats.activeDays} of ${period === '7d' ? 7 : period === '30d' ? 30 : 60} days in this window.`)
  }

  return { hook, insights: insights.slice(0, 2) }
}

export function economicCardFace(grade: TokenMechanicGrade, period: Period): GradeCardFace {
  const hook = economicHook(grade.pct, grade.letter, grade.trend)
  const insights: string[] = []

  const trendLine = trendInsight(grade.trendExplanation, period)
  if (trendLine) insights.push(trendLine)

  if (grade.counts.repos === 1 && insights.length < 2) {
    insights.push('One burn app drove the sample — this grade tracks that repo closely.')
  } else if (grade.counts.repos > 0 && insights.length < 2) {
    insights.push(`${grade.counts.repos} burn apps with commits in this window.`)
  }

  const mix = commitMixInsight(
    grade.counts.high,
    grade.counts.mid,
    grade.counts.low,
    grade.counts.high + grade.counts.mid + grade.counts.low,
    'TM',
  )
  if (mix && insights.length < 2) insights.push(mix)

  insights.push(...signalInsights(grade.signals))

  if (grade.tagCommits && period !== '60d' && insights.length < 2) {
    const holder = grade.tagCommits.direct + grade.tagCommits.lock + grade.tagCommits.indirect
    if (holder > 0 && grade.tagCommits.infra === 0) {
      insights.push('All commit weight stayed on holder-facing repos — no infra dilution.')
    } else if (grade.tagCommits.infra > holder && insights.length < 2) {
      insights.push('Infra/R&D commits outpaced holder-facing work this window.')
    }
  }

  return { hook, insights: insights.slice(0, 2) }
}

function trendFlavor(trend: TrendDirection, subject: string): string {
  if (trend === 'up') return `It's picked up compared to the last stretch, so ${subject} is trending the right way.`
  if (trend === 'down') return `It's eased off a bit versus the last stretch, so ${subject} is worth keeping an eye on.`
  return ''
}

/** 2-3 plain-English sentences (no numbers/jargon) for the card face when AI digest is unavailable. */
export function builderCardLayman(
  grade: BuilderGrade,
  period: Period,
  _stats?: { commits: number; activeDays: number; newRepos: number } | null,
): string {
  const tier = letterTier(grade.letter)
  const base =
    tier === 'top'
      ? 'clawdbotatg is shipping code almost every day across a healthy spread of projects. Momentum like this usually means new features and fixes are landing quickly.'
      : tier === 'solid'
        ? 'Work is landing regularly across several projects, just not at a full sprint. It reads as a dependable, steady pace rather than a burst.'
        : tier === 'mixed'
          ? 'Some days see real work and others are quiet, so the overall pace is moderate. There is activity, but it is not consistent across the board.'
          : 'Not much landed on the tracked projects in this window. Things are on the quiet side for now.'
  const flavor = period === '60d' ? '' : trendFlavor(grade.trend, 'the pace')
  return flavor ? `${base} ${flavor}` : base
}

export function economicCardLayman(grade: TokenMechanicGrade, period: Period): string {
  const tier = letterTier(grade.letter)
  const base =
    tier === 'top'
      ? 'The apps tied to how $CLAWD gets bought and burned are in good shape where the work is happening. The economic side looks healthy right now.'
      : tier === 'solid'
        ? 'The burn-focused apps are holding up well, with a little room to sharpen how they serve holders. Solid overall, not spectacular.'
        : tier === 'mixed'
          ? 'The picture for burn apps is mixed — some look strong while others still need work. Effort is landing unevenly across them.'
          : 'Most of the quality work this window did not land on the burn-focused apps. This side needs some attention.'
  const flavor = period === '60d' ? '' : trendFlavor(grade.trend, 'the economic side')
  return flavor ? `${base} ${flavor}` : base
}

export function integrityCardLayman(grade: IntegrityGrade, period: Period): string {
  const tier = letterTier(grade.letter)
  const base =
    tier === 'top'
      ? 'The projects getting the most attention are the ones that keep their promises to holders. Trust and transparency are looking strong.'
      : tier === 'solid'
        ? 'Most of the work is landing on trustworthy projects, with a few weaker spots. Broadly, it lines up with what holders are told.'
        : tier === 'mixed'
          ? 'Trust is a mixed bag — effort is split between solid projects and shakier ones. It is worth keeping an eye on.'
          : 'A lot of the work landed on projects with weaker trust signals. This is the area to watch most closely.'
  const flavor = period === '60d' ? '' : trendFlavor(grade.trend, 'trust')
  return flavor ? `${base} ${flavor}` : base
}

export function integrityCardFace(grade: IntegrityGrade, period: Period): GradeCardFace {
  const hook = integrityHook(grade.pct, grade.letter, grade.trend)
  const insights: string[] = []

  const trendLine = trendInsight(grade.trendExplanation, period)
  if (trendLine) insights.push(trendLine)

  const mix = commitMixInsight(
    grade.counts.high,
    grade.counts.mid,
    grade.counts.low,
    grade.counts.commitWeight,
    'integrity',
  )
  if (mix) insights.push(mix)

  insights.push(...signalInsights(grade.signals))

  const weakest = [...grade.signals]
    .filter(s => s.label !== 'High-integrity share')
    .sort((a, b) => a.pct - b.pct)[0]
  if (weakest && weakest.pct < 50 && insights.length < 2) {
    insights.push(`${weakest.label} is the drag — ${weakest.pct}% avg across active repos.`)
  }

  return { hook, insights: insights.slice(0, 2) }
}
