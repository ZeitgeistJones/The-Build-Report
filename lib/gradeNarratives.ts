import { Repo, Tag } from './scores'
import { GitHubStats, RepoActivity } from './github'
import { Period, formatTrendPct, TrendExplanation, TrendDirection } from './grades'
import {
  formatRepoLeaders,
  topReposByCommits,
  type RepoCommitLeader,
} from './gradeCardCopy'

export type { TrendExplanation }

function priorWindowLabel(period: Period): string {
  if (period === '30d') return 'the month before'
  if (period === '24h') return 'the day before'
  return 'the week before'
}

function currentWindowLabel(period: Period): string {
  if (period === '30d') return 'the last 30 days'
  if (period === '24h') return 'the last 24 hours'
  return 'the last 7 days'
}

function commitCount(activity: RepoActivity, period: Period, window: 'current' | 'prior'): number {
  if (period === '30d') {
    return window === 'current' ? (activity.commits30d ?? 0) : (activity.commits30_60 ?? 0)
  }
  if (period === '24h') {
    return window === 'current' ? (activity.commits24h ?? 0) : (activity.commits24_48 ?? 0)
  }
  if (period === '60d') {
    return window === 'current'
      ? (activity.commits30d ?? 0) + (activity.commits30_60 ?? 0)
      : 0
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

function tagLabel(tag: Tag): string {
  if (tag === 'supply-lock') return 'supply lock'
  if (tag === 'infrastructure' || tag === 'theoretical') return 'infra/R&D'
  return tag
}

function holderFacingTag(tag: Tag): boolean {
  return tag === 'direct' || tag === 'supply-lock' || tag === 'indirect'
}

function formatRepoNames(repos: Repo[], stats: GitHubStats, period: Period, max = 2): string {
  const leaders: RepoCommitLeader[] = repos
    .map(r => {
      const live = stats.repoActivity[r.githubSlug]
      const commits = live ? commitCount(live, period, 'current') : 0
      return { slug: r.githubSlug, name: r.name, commits }
    })
    .filter(r => r.commits > 0)
    .sort((a, b) => b.commits - a.commits)
  return formatRepoLeaders(leaders, max)
}

function groupByTagSentence(
  repos: Repo[],
  stats: GitHubStats,
  period: Period,
  verb: 'picked up' | 'went quiet',
): string[] {
  const byTag = new Map<string, Repo[]>()
  for (const repo of repos) {
    const label = tagLabel(repo.tag)
    const list = byTag.get(label) ?? []
    list.push(repo)
    byTag.set(label, list)
  }

  const lines: string[] = []
  for (const [label, tagRepos] of byTag) {
    const count = tagRepos.length
    const leaders = formatRepoNames(tagRepos, stats, period, 2)
    if (count === 1) {
      lines.push(`${leaders} (${label}) ${verb} activity.`)
    } else {
      lines.push(
        `${count} ${label} projects ${verb} activity${leaders ? `, led by ${leaders}` : ''}.`,
      )
    }
  }
  return lines
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
  repos?: Repo[],
): TrendExplanation {
  const current = builderInputs(stats, period, 'current')
  const prior = builderInputs(stats, period, 'prior')
  const bullets: string[] = []

  const commitShift =
    current.commits !== prior.commits
      ? current.commits > prior.commits
        ? `Shipping picked up — more work landed in ${currentWindowLabel(period)} than ${priorWindowLabel(period)}.`
        : `Shipping eased — less work landed than ${priorWindowLabel(period)}.`
      : null
  if (commitShift) bullets.push(commitShift)

  const dayShift =
    current.activeDays !== prior.activeDays
      ? current.activeDays > prior.activeDays
        ? 'Activity spread across more days this window.'
        : 'Activity was more concentrated on fewer days.'
      : null
  if (dayShift && bullets.length < 3) bullets.push(dayShift)

  const topNow = topReposByCommits(stats, repos, period, 'current', 3)
  if (topNow.length) {
    bullets.push(`Most visible work came from ${formatRepoLeaders(topNow, 2)}.`)
  }

  if (current.newRepos > prior.newRepos && current.newRepos > 0 && bullets.length < 4) {
    bullets.push('New projects joined the active set — the footprint is widening.')
  } else if (trend === 'down' && bullets.length < 4) {
    const topPrior = topReposByCommits(stats, repos, period, 'prior', 2)
    if (topPrior.length) {
      bullets.push(`The prior window was busier around ${formatRepoLeaders(topPrior, 2)}.`)
    }
  }

  if (!bullets.length) {
    bullets.push('Activity looks about the same as the prior window across tracked projects.')
  }

  const trendLabel = formatTrendPct(trendPct, period)
  const headline =
    trend === 'up'
      ? `Shipping pace rose (${trendLabel}) — ${currentWindowLabel(period)} was busier than ${priorWindowLabel(period)}.`
      : trend === 'down'
        ? `Shipping pace softened (${trendLabel}) — ${currentWindowLabel(period)} was quieter than ${priorWindowLabel(period)}.`
        : `Shipping pace held steady (${trendLabel}) compared with ${priorWindowLabel(period)}.`

  return { headline, bullets: bullets.slice(0, 4) }
}

function totalCommitsInWindow(
  stats: GitHubStats,
  repos: Repo[],
  period: Period,
  window: 'current' | 'prior',
): number {
  return repos.reduce((sum, repo) => {
    const live = stats.repoActivity[repo.githubSlug]
    return sum + (live ? commitCount(live, period, window) : 0)
  }, 0)
}

export function buildTokenMechanicTrendExplanation(
  stats: GitHubStats,
  period: Period,
  holderRepoSet: Repo[],
  trendPct: number | null,
  trend: TrendDirection,
  allRepos?: Repo[],
): TrendExplanation {
  const activeNow = reposActiveInWindow(stats, holderRepoSet, period, 'current')
  const activePrior = reposActiveInWindow(stats, holderRepoSet, period, 'prior')
  const nowSlugs = new Set(activeNow.map(r => r.githubSlug))
  const priorSlugs = new Set(activePrior.map(r => r.githubSlug))

  const newlyActive = activeNow.filter(r => !priorSlugs.has(r.githubSlug))
  const quietNow = activePrior.filter(r => !nowSlugs.has(r.githubSlug))

  const bullets: string[] = []

  const ecosystem = allRepos ?? holderRepoSet
  const holderFacingNow = ecosystem.filter(r => holderFacingTag(r.tag))
  const holderCommitsNow = totalCommitsInWindow(stats, holderFacingNow, period, 'current')
  const totalCommitsNow = totalCommitsInWindow(stats, ecosystem, period, 'current')
  if (totalCommitsNow > 0 && bullets.length < 4) {
    const share = Math.round((holderCommitsNow / totalCommitsNow) * 100)
    if (share < 20) {
      bullets.push(
        `Only ${share}% of commits this window landed on holder-facing apps and locks — most shipping was background tooling, which limits what this grade can say about CLAWD value delivery.`,
      )
    }
  }

  if (newlyActive.length) {
    if (newlyActive.length === 1) {
      const name = formatRepoNames(newlyActive, stats, period, 1)
      bullets.push(`${name} joined the holder-economics sample with new activity.`)
    } else {
      bullets.push(
        `${newlyActive.length} holder-facing projects picked up activity${formatRepoNames(newlyActive, stats, period, 2) ? `, led by ${formatRepoNames(newlyActive, stats, period, 2)}` : ''}.`,
      )
    }
  }

  if (quietNow.length && bullets.length < 4) {
    const quietNames = formatRepoNames(quietNow, stats, period, 2)
    bullets.push(
      quietNames
        ? `Holder-facing projects that were busy before went quiet, including ${quietNames}.`
        : `${quietNow.length} holder-facing projects that were active before went quiet this window.`,
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

  if (rubricNow != null && rubricPrior != null && rubricNow !== rubricPrior && bullets.length < 4) {
    const dir = rubricNow > rubricPrior ? 'stronger' : 'weaker'
    bullets.push(
      `The projects that moved this window score ${dir} on how well they serve holders than the ones that moved before.`,
    )
  }

  const holderNow = holderCommitsNow
  const holderPrior = totalCommitsInWindow(stats, holderFacingNow, period, 'prior')

  if (holderNow > holderPrior && bullets.length < 4) {
    bullets.push('More commits landed on holder-facing apps and locks than the prior window.')
  } else if (holderNow < holderPrior && bullets.length < 4) {
    bullets.push('Fewer commits landed on holder-facing apps and locks than the prior window.')
  }

  if (!bullets.length) {
    bullets.push('The mix of active projects looks similar to the prior window.')
  }

  const trendLabel = formatTrendPct(trendPct, period)
  const headline =
    trend === 'up'
      ? `Holder economics improved (${trendLabel}) — the busiest projects score better on how they serve holders.`
      : trend === 'down'
        ? `Holder economics dipped (${trendLabel}) — more of the visible work landed on weaker holder-facing projects.`
        : `Holder economics held steady (${trendLabel}) — similar quality where work happened.`

  return { headline, bullets: bullets.slice(0, 4) }
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

  const bullets: string[] = []

  if (added.length) {
    const names = formatRepoNames(added, stats, period, 2)
    bullets.push(`New projects entered the sample${names ? `, including ${names}` : ''}.`)
  }

  if (lowAdded.length && bullets.length < 4) {
    bullets.push(
      `Some newly active projects score lower on safety and transparency (${formatRepoNames(lowAdded, stats, period, 2)}).`,
    )
  }

  if (highDropped.length && bullets.length < 4) {
    bullets.push(
      `Trustworthy projects that were busy before went quiet (${formatRepoNames(highDropped, stats, period, 2)}).`,
    )
  }

  const topByCommits = topReposByCommits(stats, repoSet, period, 'current', 3)
  if (topByCommits.length && bullets.length < 4) {
    bullets.push(`Most work landed on ${formatRepoLeaders(topByCommits, 2)}.`)
  }

  const highNow = sample.filter(r => r.builderIntegrity.pct >= 80).length
  const highPrior = priorSample.filter(r => r.builderIntegrity.pct >= 80).length
  const lowNow = sample.filter(
    r => r.builderIntegrity.pct < 60 && r.builderIntegrity.letter !== '—',
  ).length
  const lowPrior = priorSample.filter(
    r => r.builderIntegrity.pct < 60 && r.builderIntegrity.letter !== '—',
  ).length

  if ((highNow > highPrior || lowNow < lowPrior) && bullets.length < 4) {
    bullets.push('More of the active set is landing on projects that keep their promises to holders.')
  } else if ((lowNow > lowPrior || highNow < highPrior) && bullets.length < 4) {
    bullets.push('More of the visible work shifted toward projects with weaker safety and testing scores.')
  }

  if (!bullets.length) {
    bullets.push('Trust and alignment look about the same as the prior window.')
  }

  const trendLabel = formatTrendPct(trendPct, period)
  const headline =
    trend === 'up'
      ? `Trust rose (${trendLabel}) — the busiest projects better match what they tell holders.`
      : trend === 'down'
        ? `Trust fell (${trendLabel}) — work shifted toward projects with weaker safety and alignment scores.`
        : `Trust held steady (${trendLabel}) — similar alignment where work happened.`

  return { headline, bullets: bullets.slice(0, 4) }
}
