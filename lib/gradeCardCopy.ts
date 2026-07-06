import type {
  BuilderGrade,
  IntegrityGrade,
  Period,
  TokenMechanicGrade,
  TrendDirection,
  TrendExplanation,
} from '@/lib/grades'
import type { GitHubStats } from '@/lib/github'
import type { Repo } from '@/lib/scores'
import { commitsInWindow } from '@/lib/scoringShared'
import { isConsumerEconomicScored } from '@/lib/economicGrade'

export function humanizeRepoSlug(slug: string): string {
  return slug.replace(/-/g, ' ')
}

function repoDisplayName(slug: string, repos?: Repo[]): string {
  return repos?.find(r => r.githubSlug === slug)?.name ?? humanizeRepoSlug(slug)
}

export interface RepoCommitLeader {
  slug: string
  name: string
  commits: number
}

export function topReposByCommits(
  stats: GitHubStats,
  repos: Repo[] | undefined,
  period: Period,
  window: 'current' | 'prior' = 'current',
  limit = 3,
  filter?: (repo: Repo) => boolean,
): RepoCommitLeader[] {
  const leaders: RepoCommitLeader[] = []

  for (const [slug, activity] of Object.entries(stats.repoActivity)) {
    const commits = commitsInWindow(activity, period, window)
    if (commits <= 0) continue
    const repo = repos?.find(r => r.githubSlug === slug)
    if (filter && (!repo || !filter(repo))) continue
    leaders.push({ slug, name: repoDisplayName(slug, repos), commits })
  }

  return leaders.sort((a, b) => b.commits - a.commits).slice(0, limit)
}

export function formatRepoLeaders(leaders: RepoCommitLeader[], maxNames = 2): string {
  if (!leaders.length) return ''
  const names = leaders.slice(0, maxNames).map(l => l.name)
  const extraCount = leaders.length - maxNames
  const extra = extraCount > 0 ? ` and ${extraCount} more` : ''
  if (names.length === 1) return names[0] + extra
  if (names.length === 2) return `${names[0]} and ${names[1]}${extra}`
  return `${names.join(', ')}${extra}`
}

export function dominantRepoSentence(
  leaders: RepoCommitLeader[],
  totalCommits: number,
  kind: 'shipping' | 'holder' | 'standards',
): string | null {
  if (!leaders.length || totalCommits <= 0) return null
  const top = leaders[0]
  const topShare = top.commits / totalCommits
  const names = formatRepoLeaders(leaders, 2)

  if (leaders.length === 1 || topShare >= 0.55) {
    if (kind === 'holder') {
      return `${top.name} drove most of the holder-facing work we could score this window.`
    }
    if (kind === 'standards') {
      return `Most of the visible work landed on ${top.name}.`
    }
    return `${top.name} carried most of the shipping this window.`
  }

  if (kind === 'holder') {
    return `Holder-facing work was spread across several projects, led by ${names}.`
  }
  if (kind === 'standards') {
    return `Work was spread across several projects, led by ${names}.`
  }
  return `Shipping was led by ${names}.`
}

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

function periodPhrase(period: Period): string {
  if (period === '24h') return 'the last 24 hours'
  if (period === '7d') return 'the last 7 days'
  if (period === '30d') return 'the last 30 days'
  return 'the last 60 days'
}

function priorPhrase(period: Period): string {
  if (period === '24h') return '24 hours'
  if (period === '7d') return '7 days'
  if (period === '30d') return '30 days'
  return '60 days'
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
    if (trend === 'up') return 'Standards are climbing — commits landed on higher-scoring repos.'
    return 'Heavy commits mostly hit repos with strong rubric scores.'
  }
  if (tier === 'solid') {
    if (trend === 'down') return 'Mostly solid scores, but more weight on mid-tier repos lately.'
    return 'Rubric scores mostly match the work — a few soft spots.'
  }
  if (tier === 'mixed') {
    if (trend === 'down') return 'Standards are split — commit volume didn’t follow the strongest repos.'
    return 'Rubric scores are mixed across where commits landed.'
  }
  if (trend === 'down') return 'Most commit weight landed on lower-scoring repos this window.'
  if (pct < 45) return 'Commits on weaker rubric scores dominated this window.'
  return 'Builder standards need attention where work happened.'
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
    insights.push(`Active ${stats.activeDays} of ${period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 60} days in this window.`)
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

function trendFlavor(trend: TrendDirection, subject: string, period: Period): string {
  if (period === '60d') {
    return 'This is the two-month picture — we do not compare it to an earlier 60-day window yet.'
  }
  if (trend === 'up') {
    return `Compared with the prior ${priorPhrase(period)}, ${subject} has picked up.`
  }
  if (trend === 'down') {
    return `Compared with the prior ${priorPhrase(period)}, ${subject} has eased off a bit.`
  }
  if (trend === 'new') {
    return `This is a fresh burst of activity versus the prior ${priorPhrase(period)}.`
  }
  return `Holding about steady versus the prior ${priorPhrase(period)}.`
}

function economicCommitWeight(grade: TokenMechanicGrade): number {
  return grade.counts.high + grade.counts.mid + grade.counts.low
}

function weakestIntegritySignal(grade: IntegrityGrade): string | null {
  const candidates = grade.signals.filter(s => s.label !== 'High-standards share')
  if (!candidates.length) return null
  const weakest = [...candidates].sort((a, b) => a.pct - b.pct)[0]
  if (!weakest || weakest.pct >= 55) return null
  return weakest.label.toLowerCase()
}

/** 2-3 plain-English sentences for the card face when AI digest is unavailable. */
export function builderCardLayman(
  grade: BuilderGrade,
  period: Period,
  stats?: { commits: number; activeDays: number; newRepos: number } | null,
  githubStats?: GitHubStats | null,
  repos?: Repo[],
): string {
  const window = periodPhrase(period)

  if (stats && stats.commits === 0) {
    if (period === '24h') {
      return `Nothing landed on tracked projects in the last 24 hours — there is no today story yet. Switch to 7d or 30d for the fuller picture of what has been shipping.`
    }
    return `No tracked GitHub activity in ${window}. The letter grade reflects an empty window, not a verdict on the ecosystem — try a longer period for context.`
  }

  const tier = letterTier(grade.letter)
  let base: string

  if (period === '60d') {
    base =
      tier === 'top'
        ? `Over the last two months, clawdbotatg has kept a strong shipping rhythm across many projects. Sustained output like this is what holders usually want to see.`
        : tier === 'solid'
          ? `Across the last two months, work has landed steadily — not a single sprint, but a dependable build cadence.`
          : tier === 'mixed'
            ? `The two-month view is uneven: some stretches were busy and others quiet, so the overall pace reads as moderate.`
            : `The last two months were light on tracked GitHub activity relative to what this dashboard usually sees.`
    const leaders = githubStats ? topReposByCommits(githubStats, repos, period, 'current', 3) : []
    const dominant = leaders.length && stats
      ? dominantRepoSentence(leaders, stats.commits, 'shipping')
      : null
    return `${base}${dominant ? ` ${dominant}` : ''} ${trendFlavor(grade.trend, 'builder pace', period)}`
  }

  if (period === '24h' && stats && stats.commits > 0) {
    base =
      tier === 'top'
        ? `In the last day, fresh work showed up on multiple tracked projects — a live pulse, not just background noise.`
        : tier === 'solid'
          ? `The last 24 hours saw real commits land, even if it was not a flood. Short windows are noisy; this one looks active.`
          : `There was some activity in the last day, but it was thin — enough to register, not enough to call a hot streak.`
    return `${base} ${trendFlavor(grade.trend, 'the pace', period)}`
  }

  if (period === '7d') {
    base =
      tier === 'top'
        ? `This week, clawdbotatg has been shipping across a healthy spread of projects — the kind of rhythm that usually means fixes and features are landing in real time.`
        : tier === 'solid'
          ? `This week shows dependable output: several projects moved, just not at an all-out sprint.`
          : tier === 'mixed'
            ? `This week was hit-or-miss — some days and projects saw work, others did not.`
            : `This week was quiet on the tracked repos we follow.`
  } else {
    base =
      tier === 'top'
        ? `This month, clawdbotatg has been shipping almost daily across a wide set of projects — momentum like this usually means holders are seeing real movement.`
        : tier === 'solid'
          ? `This month, work has landed regularly across several projects — steady and reliable, if not a peak burst.`
          : tier === 'mixed'
            ? `This month has been uneven: real work showed up, but not every day and not everywhere.`
            : `This month was light on tracked activity — fewer projects saw meaningful updates.`
  }

  const leaders = githubStats ? topReposByCommits(githubStats, repos, period, 'current', 3) : []
  const dominant =
    leaders.length && stats?.commits
      ? dominantRepoSentence(leaders, stats.commits, 'shipping')
      : null
  return `${base}${dominant ? ` ${dominant}` : ''} ${trendFlavor(grade.trend, 'the pace', period)}`
}

export function economicCardLayman(
  grade: TokenMechanicGrade,
  period: Period,
  stats?: { commits: number } | null,
  githubStats?: GitHubStats | null,
  repos?: Repo[],
): string {
  const window = periodPhrase(period)
  const weight = economicCommitWeight(grade)
  const holderFacing =
    (grade.tagCommits?.direct ?? 0) +
    (grade.tagCommits?.lock ?? 0) +
    (grade.tagCommits?.indirect ?? 0)

  if (weight === 0 && grade.counts.repos === 0) {
    if (stats?.commits === 0 || (period === '24h' && !holderFacing)) {
      return `There was not enough holder-facing work in ${window} to say much about economics. The grade is mostly reflecting quiet data, not a clean read on apps and locks.`
    }
    return `We do not have enough holder-facing project activity in ${window} to draw a strong economics read. Check a longer window once more work lands on those projects.`
  }

  const tier = letterTier(grade.letter)
  let base: string

  if (period === '60d') {
    base =
      tier === 'top'
        ? `Over two months, the projects that serve holders directly have looked economically sound where the work actually happened.`
        : tier === 'solid'
          ? `Across two months, holder-facing projects are holding up — solid mechanics, with room to sharpen the story.`
          : tier === 'mixed'
            ? `The two-month holder-economics picture is mixed: strong spots and weak spots, depending on where commits landed.`
            : `Over two months, much of the meaningful work did not concentrate on the holder-facing projects we score hardest.`
    return `${base} ${trendFlavor(grade.trend, 'holder economics', period)}`
  }

  if (period === '24h') {
    base =
      tier === 'top'
        ? `In the last day, the holder-facing work that did ship scored well on how it serves the community.`
        : tier === 'solid'
          ? `Yesterday's holder-facing updates look reasonably sound — not perfect, but aligned with what holders expect.`
          : tier === 'mixed'
            ? `The last day did not give a clean holder-economics story — a little activity, but not a clear win.`
            : `In the last 24 hours, holder-facing projects did not put their best foot forward where we could see it.`
  } else if (period === '7d') {
    base =
      tier === 'top'
        ? `This week, apps and locks that serve holders look healthy where commits actually landed.`
        : tier === 'solid'
          ? `This week, holder economics are in decent shape — good enough to trust, with polish still available.`
          : tier === 'mixed'
            ? `This week, holder economics are split: some projects look strong, others still need work.`
            : `This week, most visible work did not land on the holder-facing projects scored here.`
  } else {
    base =
      tier === 'top'
        ? `This month, holder-facing projects look strong where the builder spent time — economics align with what holders are told.`
        : tier === 'solid'
          ? `This month, holder economics are holding up well, with a little room to sharpen how projects serve the community.`
          : tier === 'mixed'
            ? `This month, the holder-economics picture is uneven — effort landed in different quality buckets.`
            : `This month, much of the work we can see did not concentrate on holder-facing projects.`
  }

  const holderLeaders = githubStats
    ? topReposByCommits(githubStats, repos, period, 'current', 3, isConsumerEconomicScored)
    : []
  const holderWeight = grade.counts.high + grade.counts.mid + grade.counts.low
  const dominant =
    holderLeaders.length && holderWeight > 0
      ? dominantRepoSentence(holderLeaders, holderWeight, 'holder')
      : null

  if (dominant) {
    base += ` ${dominant}`
  } else if (grade.counts.repos === 1 && holderLeaders[0]) {
    base += ` ${holderLeaders[0].name} drove almost the entire sample here, so this grade tracks that project closely.`
  }

  if (grade.holderCoveragePct != null && grade.holderCoveragePct < 20) {
    base += ` Only about ${grade.holderCoveragePct}% of commits this window landed on holder-facing projects — most activity was elsewhere, so this grade reflects thin CLAWD value delivery as much as app quality.`
  }

  return `${base} ${trendFlavor(grade.trend, 'holder economics', period)}`
}

export function integrityCardLayman(
  grade: IntegrityGrade,
  period: Period,
  githubStats?: GitHubStats | null,
  repos?: Repo[],
): string {
  const window = periodPhrase(period)

  if (grade.counts.commitWeight === 0 && grade.counts.active === 0) {
    return `Not enough scored project activity in ${window} to read builder standards. This grade needs commits on scored repos — try a longer window.`
  }

  const lowShare =
    grade.counts.commitWeight > 0
      ? Math.round((grade.counts.low / grade.counts.commitWeight) * 100)
      : 0
  const weakGrade = grade.pct < 60

  const tier = letterTier(grade.letter)
  const drag = weakestIntegritySignal(grade)
  let base: string

  if (period === '60d') {
    base =
      tier === 'top'
        ? `Over two months, the busiest projects generally score well on safety, testing, and transparency.`
        : tier === 'solid'
          ? `Across two months, most work landed on repos with solid rubric scores, with a few softer spots.`
          : tier === 'mixed'
            ? `The two-month standards picture is mixed — stronger and weaker repos both saw attention.`
            : `Over two months, a lot of visible work landed on projects that score lower on security, testing, and transparency.`
  } else if (period === '24h') {
    base =
      tier === 'top'
        ? `In the last day, the projects that moved score reasonably well on the builder-standards rubric.`
        : tier === 'solid'
          ? `Yesterday's updates mostly landed on mid-to-high rubric scores, with minor weak spots.`
          : tier === 'mixed'
            ? `The last day does not give a clean standards read — a little activity, mixed rubric scores.`
            : `In the last 24 hours, the work we could see leaned toward repos with weaker safety and testing scores.`
  } else if (period === '7d') {
    base =
      tier === 'top'
        ? `This week, commits concentrated on repos with stronger safety and transparency scores.`
        : tier === 'solid'
          ? `This week, rubric scores are mostly in good shape, with a few repos worth watching.`
          : tier === 'mixed'
            ? `This week, standards are split — some higher-scoring repos moved, others less so.`
            : `This week, much of the work landed on repos with weaker security, testing, and transparency scores.`
  } else {
    base =
      tier === 'top'
        ? `This month, the projects getting attention score well on the builder-standards rubric.`
        : tier === 'solid'
          ? `This month, most work landed on solid-scoring repos, though not perfectly everywhere.`
          : tier === 'mixed'
            ? `This month, standards are a mixed bag — effort split between stronger and weaker rubric scores.`
            : `This month, a lot of work landed on projects that score lower on security, testing, and transparency — this is the card to watch.`
  }

  if (weakGrade && lowShare >= 40) {
    base = `This window, a large share of commits landed on projects with weaker safety, testing, and transparency scores — that pulls the standards grade down even when the work itself looks like routine polish. ${base}`
  } else if (weakGrade) {
    base = `Overall rubric scores are weak this window — the busiest projects do not score well on builder standards. ${base}`
  }

  if (drag && tier !== 'top') {
    base += ` The weakest area in the rubric right now is ${drag}.`
  }

  const leaders = githubStats ? topReposByCommits(githubStats, repos, period, 'current', 3) : []
  const dominant =
    leaders.length && grade.counts.commitWeight > 0
      ? dominantRepoSentence(leaders, grade.counts.commitWeight, 'standards')
      : null

  return `${base}${dominant ? ` ${dominant}` : ''} ${trendFlavor(grade.trend, 'builder standards', period)}`
}

/** True when digest exists but this period's card blurbs are missing (old cache shape). */
export function digestMissingPeriodCards(
  cards: Partial<Record<Period, { builder?: string; economic?: string; integrity?: string }>> | null,
  period: Period,
): boolean {
  if (!cards) return false
  const row = cards[period]
  return !row?.builder || !row?.economic || !row?.integrity
}

export function builderWindowStatsFromGitHub(
  stats: GitHubStats,
  period: Period,
): { commits: number; activeDays: number; newRepos: number } {
  if (period === '24h') {
    return {
      commits: stats.totalCommits24h ?? 0,
      activeDays: stats.activeDays24h ?? 0,
      newRepos: stats.newRepos24h ?? 0,
    }
  }
  if (period === '7d') {
    return {
      commits: stats.totalCommits7d,
      activeDays: stats.activeDays7d,
      newRepos: stats.newRepos7d,
    }
  }
  if (period === '30d') {
    return {
      commits: stats.totalCommits30d,
      activeDays: stats.activeDays30d,
      newRepos: stats.newRepos30d,
    }
  }
  return {
    commits: stats.totalCommits30d + stats.totalCommits30_60,
    activeDays: stats.activeDays30d + stats.activeDays30_60,
    newRepos: stats.newRepos30d + stats.newRepos30_60,
  }
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
    .filter(s => s.label !== 'High-standards share')
    .sort((a, b) => a.pct - b.pct)[0]
  if (weakest && weakest.pct < 50 && insights.length < 2) {
    insights.push(`${weakest.label} is the drag — ${weakest.pct}% avg across active repos.`)
  }

  return { hook, insights: insights.slice(0, 2) }
}
