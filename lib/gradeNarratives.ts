import { Repo, Tag } from './scores'
import { GitHubStats, RepoActivity } from './github'
import { Period, formatTrendPct, TrendExplanation, TrendDirection } from './grades'

export type { TrendExplanation }

function priorWindowLabel(period: Period): string {
  if (period === '30d') return 'prior 30d (days 31–60)'
  if (period === '24h') return 'prior 24h (24–48h ago)'
  return 'prior 7d (days 8–14)'
}

function currentWindowLabel(period: Period): string {
  if (period === '30d') return 'last 30 days'
  if (period === '24h') return 'last 24 hours'
  return 'last 7 days'
}

function commitCount(activity: RepoActivity, period: Period, window: 'current' | 'prior'): number {
  if (period === '30d') {
    return window === 'current' ? (activity.commits30d ?? 0) : (activity.commits30_60 ?? 0)
  }
  if (period === '24h') {
    return window === 'current' ? (activity.commits24h ?? 0) : (activity.commits24_48 ?? 0)
  }
  return window === 'current' ? (activity.commits7d ?? 0) : (activity.commits7_14 ?? 0)
}

function reposActiveInWindow(
  stats: GitHubStats,
  repoSet: Repo[],
  period: Period,
  window: 'current' | 'prior',
): Repo[] {
  return repoSet.filter(repo => {
    const live = stats.repoActivity[repo.githubSlug]
    if (!live) return false
    return commitCount(live, period, window) > 0
  })
}

function topReposByCommits(
  stats: GitHubStats,
  period: Period,
  window: 'current' | 'prior',
  limit = 5,
): { name: string; commits: number }[] {
  return Object.values(stats.repoActivity)
    .map(a => ({ name: a.slug, commits: commitCount(a, period, window) }))
    .filter(r => r.commits > 0)
    .sort((a, b) => b.commits - a.commits)
    .slice(0, limit)
}

function formatRepoList(repos: Repo[], max = 4): string {
  if (!repos.length) return 'none'
  const names = repos.slice(0, max).map(r => r.name)
  const extra = repos.length > max ? ` +${repos.length - max} more` : ''
  return names.join(', ') + extra
}

function tagLabel(tag: Tag): string {
  if (tag === 'supply-lock') return 'supply lock'
  if (tag === 'infrastructure' || tag === 'theoretical') return 'infra/R&D'
  return tag
}

function tokenMechanicWeight(tag: Tag): string {
  if (tag === 'direct') return 'direct burn'
  if (tag === 'supply-lock') return 'supply lock'
  if (tag === 'indirect') return 'indirect'
  return 'infra/R&D'
}

function diffMetricForPeriod(
  label: string,
  current: number,
  prior: number,
  period: Period,
): string | null {
  if (current === prior) return null
  const dir = current > prior ? 'up' : 'down'
  return `${label} ${dir}: ${current} this window vs ${prior} ${priorWindowLabel(period).split('(')[0].trim()}`
}

function builderInputs(stats: GitHubStats, period: Period, window: 'current' | 'prior') {
  const activityCount = Object.keys(stats.repoActivity).length
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
  }
}

export function buildBuilderTrendExplanation(
  stats: GitHubStats,
  period: Period,
  trendPct: number | null,
  trend: TrendDirection,
): TrendExplanation {
  const current = builderInputs(stats, period, 'current')
  const prior = builderInputs(stats, period, 'prior')
  const bullets: string[] = []

  for (const line of [
    diffMetricForPeriod('Commits', current.commits, prior.commits, period),
    diffMetricForPeriod('Active days', current.activeDays, prior.activeDays, period),
    diffMetricForPeriod('New repos', current.newRepos, prior.newRepos, period),
    diffMetricForPeriod('Repos with commits', current.activeRepos, prior.activeRepos, period),
  ]) {
    if (line) bullets.push(line)
  }

  const topNow = topReposByCommits(stats, period, 'current', 5)
  if (topNow.length) {
    bullets.push(
      `Most commits this window: ${topNow.map(r => `${r.name} (${r.commits})`).join(', ')}.`,
    )
  }

  bullets.push('List order still follows GitHub last-pushed; grades weight by commit volume.')

  const topPrior = topReposByCommits(stats, period, 'prior', 3)
  if (topPrior.length && trend === 'down') {
    bullets.push(
      `Prior window was led by ${topPrior.map(r => `${r.name} (${r.commits})`).join(', ')}.`,
    )
  }

  if (!bullets.length) {
    bullets.push('Activity levels are similar to the prior window across tracked repos.')
  }

  const trendLabel = formatTrendPct(trendPct, period)
  const headline =
    trend === 'up'
      ? `Shipping pace rose (${trendLabel}) — more GitHub activity in the ${currentWindowLabel(period)} than ${priorWindowLabel(period)}.`
      : trend === 'down'
        ? `Shipping pace softened (${trendLabel}) — less activity in the ${currentWindowLabel(period)} than ${priorWindowLabel(period)}.`
        : `Shipping pace held steady (${trendLabel}) compared with ${priorWindowLabel(period)}.`

  return { headline, bullets: bullets.slice(0, 5) }
}

export function buildTokenMechanicTrendExplanation(
  stats: GitHubStats,
  period: Period,
  repoSet: Repo[],
  trendPct: number | null,
  trend: TrendDirection,
): TrendExplanation {
  const activeNow = reposActiveInWindow(stats, repoSet, period, 'current')
  const activePrior = reposActiveInWindow(stats, repoSet, period, 'prior')
  const nowSlugs = new Set(activeNow.map(r => r.githubSlug))
  const priorSlugs = new Set(activePrior.map(r => r.githubSlug))

  const newlyActive = activeNow.filter(r => !priorSlugs.has(r.githubSlug))
  const quietNow = activePrior.filter(r => !nowSlugs.has(r.githubSlug))

  const bullets: string[] = []

  if (newlyActive.length) {
    bullets.push(
      `Newly active this window: ${formatRepoList(newlyActive)} (${newlyActive.map(r => tagLabel(r.tag)).join(', ')}).`,
    )
  }

  if (quietNow.length) {
    bullets.push(
      `Quiet this window (active prior): ${formatRepoList(quietNow)} (${quietNow.map(r => tokenMechanicWeight(r.tag)).join(', ')}).`,
    )
  }

  const repoCommits = (repo: Repo, window: 'current' | 'prior') => {
    const live = stats.repoActivity[repo.githubSlug]
    return live ? commitCount(live, period, window) : 0
  }

  const rubricWeightedAvg = (repos: Repo[], window: 'current' | 'prior') => {
    let sum = 0
    let weight = 0
    for (const repo of repos) {
      if (!repo.tokenMechanic || repo.tokenMechanic.letter === '—') continue
      const w = repoCommits(repo, window)
      if (w <= 0) continue
      sum += repo.tokenMechanic.pct * w
      weight += w
    }
    return weight ? Math.round(sum / weight) : null
  }

  const rubricNow = rubricWeightedAvg(activeNow, 'current')
  const rubricPrior = rubricWeightedAvg(activePrior, 'prior')

  if (rubricNow != null && rubricPrior != null && rubricNow !== rubricPrior) {
    const dir = rubricNow > rubricPrior ? 'stronger' : 'weaker'
    bullets.push(
      `Repos that drove commits this window carried ${dir} token mechanic rubric scores (${rubricNow}% vs ${rubricPrior}% prior, commit-weighted).`,
    )
  }

  const directNowCommits = activeNow
    .filter(r => r.tag === 'direct' || r.tag === 'supply-lock' || r.tag === 'indirect')
    .reduce((sum, r) => sum + repoCommits(r, 'current'), 0)
  const directPriorCommits = activePrior
    .filter(r => r.tag === 'direct' || r.tag === 'supply-lock' || r.tag === 'indirect')
    .reduce((sum, r) => sum + repoCommits(r, 'prior'), 0)
  const infraNowCommits = activeNow
    .filter(r => r.tag === 'infrastructure' || r.tag === 'theoretical')
    .reduce((sum, r) => sum + repoCommits(r, 'current'), 0)
  const infraPriorCommits = activePrior
    .filter(r => r.tag === 'infrastructure' || r.tag === 'theoretical')
    .reduce((sum, r) => sum + repoCommits(r, 'prior'), 0)

  if (directNowCommits !== directPriorCommits || infraNowCommits !== infraPriorCommits) {
    bullets.push(
      `Tag mix (display only): ${directNowCommits} commits on holder-facing repos vs ${directPriorCommits} prior; ${infraNowCommits} on infra/R&D vs ${infraPriorCommits} prior.`,
    )
  }

  const directNow = activeNow.filter(r => r.tag === 'direct' || r.tag === 'supply-lock' || r.tag === 'indirect')
  const directPrior = activePrior.filter(r => r.tag === 'direct' || r.tag === 'supply-lock' || r.tag === 'indirect')
  if (directNow.length !== directPrior.length) {
    bullets.push(
      `Holder-facing repos with any commits: ${directNow.length} now vs ${directPrior.length} prior${directNow.length ? ` (${formatRepoList(directNow, 3)})` : ''}.`,
    )
  }

  const infraNow = activeNow.filter(r => r.tag === 'infrastructure' || r.tag === 'theoretical')
  const infraPrior = activePrior.filter(r => r.tag === 'infrastructure' || r.tag === 'theoretical')
  if (infraNowCommits > infraPriorCommits && trend === 'down') {
    bullets.push(
      `Infra/R&D commit share grew — ${infraNowCommits} commits now vs ${infraPriorCommits} prior (e.g. ${formatRepoList(infraNow, 3)}).`,
    )
  }

  if (!bullets.length) {
    bullets.push('The mix of active repo tags is similar to the prior window.')
  }

  const trendLabel = formatTrendPct(trendPct, period)
  const headline =
    trend === 'up'
      ? `Token mechanic grade improved (${trendLabel}) — repos with the most commits score stronger on the rubric this window.`
      : trend === 'down'
        ? `Token mechanic grade dipped (${trendLabel}) — commit volume landed on repos with weaker rubric scores vs the prior window.`
        : `Token mechanic grade stable (${trendLabel}) — similar commit-weighted rubric average.`

  return { headline, bullets: bullets.slice(0, 5) }
}

export function buildIntegrityTrendExplanation(
  stats: GitHubStats,
  period: Period,
  repoSet: Repo[],
  trendPct: number | null,
  trend: TrendDirection,
): TrendExplanation {
  const activeNow = reposActiveInWindow(stats, repoSet, period, 'current')
  const activePrior = reposActiveInWindow(stats, repoSet, period, 'prior')
  const sample = activeNow.length ? activeNow : repoSet
  const priorSample = activePrior

  const nowSlugs = new Set(sample.map(r => r.githubSlug))
  const priorSlugs = new Set(priorSample.map(r => r.githubSlug))

  const added = sample.filter(r => !priorSlugs.has(r.githubSlug))
  const dropped = priorSample.filter(r => !nowSlugs.has(r.githubSlug))

  const lowAdded = added.filter(r => r.builderIntegrity.pct < 60 && r.builderIntegrity.letter !== '—')
  const highDropped = dropped.filter(r => r.builderIntegrity.pct >= 80)

  const highNow = sample.filter(r => r.builderIntegrity.pct >= 80).length
  const highPrior = priorSample.filter(r => r.builderIntegrity.pct >= 80).length
  const lowNow = sample.filter(r => r.builderIntegrity.pct < 60 && r.builderIntegrity.letter !== '—').length
  const lowPrior = priorSample.filter(r => r.builderIntegrity.pct < 60 && r.builderIntegrity.letter !== '—').length

  const bullets: string[] = []

  if (added.length) {
    bullets.push(`Repos newly active: ${formatRepoList(added)}.`)
  }
  if (lowAdded.length) {
    bullets.push(
      `Lower-integrity repos entering the sample: ${formatRepoList(lowAdded)} (auto-inferred or weaker rubric scores).`,
    )
  }
  if (highDropped.length) {
    bullets.push(
      `High-integrity repos quiet this window: ${formatRepoList(highDropped)}.`,
    )
  }
  const topByCommits = topReposByCommits(stats, period, 'current', 5)
  if (topByCommits.length) {
    bullets.push(
      `Where commits landed: ${topByCommits.map(r => `${r.name} (${r.commits})`).join(', ')}.`,
    )
  }

  if (highNow !== highPrior || lowNow !== lowPrior) {
    bullets.push(
      `Repos with high/low integrity scores: ${highNow} high / ${lowNow} low now vs ${highPrior} high / ${lowPrior} low prior (unweighted repo count).`,
    )
  }

  if (!bullets.length) {
    bullets.push('The active repo sample and integrity mix are similar to the prior window.')
  }

  const trendLabel = formatTrendPct(trendPct, period)
  const headline =
    trend === 'up'
      ? `Integrity rose (${trendLabel}) — repos with the most commits score stronger on vision, autonomy, and walkaway.`
      : trend === 'down'
        ? `Integrity fell (${trendLabel}) — commit volume shifted toward lower-scoring or auto-inferred repos.`
        : `Integrity steady (${trendLabel}) — similar commit-weighted rubric average.`

  return { headline, bullets: bullets.slice(0, 5) }
}
