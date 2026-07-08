import { Repo } from './scores'
import { GitHubStats } from './github'
import { Period, formatTrendDelta, TrendExplanation, TrendDirection, shippingLeverageRepos } from './grades'
import {
  commitsInWindow,
  effectiveTag,
  isHolderFacingTag,
  reposActiveInWindow,
  selectSampleWithFallback,
} from './scoringShared'
import { getConsumerEconomicScorePct, getShippingLeverage, showsEconomicNa } from './economicGrade'
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

function tagLabel(tag: ReturnType<typeof effectiveTag>): string {
  if (tag === 'supply-lock') return 'supply lock'
  if (tag === 'infrastructure' || tag === 'theoretical') return 'infra/R&D'
  return tag
}

function formatRepoNames(repos: Repo[], stats: GitHubStats, period: Period, max = 2): string {
  const leaders: RepoCommitLeader[] = repos
    .map(r => {
      const live = stats.repoActivity[r.githubSlug]
      const commits = live ? commitsInWindow(live, period, 'current') : 0
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
    const label = tagLabel(effectiveTag(repo))
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
  const activeRepos = Object.values(stats.repoActivity).filter(r =>
    commitsInWindow(r, period, window) > 0,
  ).length
  if (period === '30d') {
    return {
      commits: window === 'current' ? stats.totalCommits30d : stats.totalCommits30_60,
      activeDays: window === 'current' ? stats.activeDays30d : stats.activeDays30_60,
      newRepos: window === 'current' ? stats.newRepos30d : stats.newRepos30_60,
      activeRepos,
      scannedRepos: activityCount,
    }
  }
  if (period === '24h') {
    return {
      commits: window === 'current' ? (stats.totalCommits24h ?? 0) : (stats.totalCommits24_48 ?? 0),
      activeDays: window === 'current' ? (stats.activeDays24h ?? 0) : (stats.activeDays24_48 ?? 0),
      newRepos: window === 'current' ? (stats.newRepos24h ?? 0) : (stats.newRepos24_48 ?? 0),
      activeRepos,
      scannedRepos: activityCount,
    }
  }
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
  pct: number,
  priorPct: number | null,
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

  const trendLabel = formatTrendDelta(pct, priorPct, period)
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
    return sum + (live ? commitsInWindow(live, period, window) : 0)
  }, 0)
}

export function buildTokenMechanicTrendExplanation(
  stats: GitHubStats,
  period: Period,
  holderRepoSet: Repo[],
  pct: number,
  priorPct: number | null,
  trend: TrendDirection,
  allRepos?: Repo[],
  newArrivalCount?: number,
): TrendExplanation {
  const activeNow = reposActiveInWindow(stats, holderRepoSet, period, 'current')
  const activePrior = reposActiveInWindow(stats, holderRepoSet, period, 'prior')
  const nowSlugs = new Set(activeNow.map(r => r.githubSlug))
  const priorSlugs = new Set(activePrior.map(r => r.githubSlug))

  const newlyActive = activeNow.filter(r => !priorSlugs.has(r.githubSlug))
  const quietNow = activePrior.filter(r => !nowSlugs.has(r.githubSlug))

  const bullets: string[] = []

  const ecosystem = allRepos ?? holderRepoSet
  const holderFacingNow = ecosystem.filter(r => isHolderFacingTag(effectiveTag(r)))
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

  if (newArrivalCount && newArrivalCount > 0 && bullets.length < 4) {
    bullets.push(
      `${newArrivalCount} project${newArrivalCount === 1 ? '' : 's'} newly entered this sample — see New arrivals →`,
    )
  } else if (newlyActive.length) {
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
    return live ? commitsInWindow(live, period, window) : 0
  }

  const rubricWeightedAvg = (repos: Repo[], window: 'current' | 'prior') => {
    let sum = 0
    let weight = 0
    for (const repo of repos) {
      const pct = getConsumerEconomicScorePct(repo)
      if (pct == null) continue
      const w = repoCommits(repo, window)
      if (w <= 0) continue
      sum += pct * w
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

  const trendLabel = formatTrendDelta(pct, priorPct, period)
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
  pct: number,
  priorPct: number | null,
  trend: TrendDirection,
  newArrivalCount?: number,
): TrendExplanation {
  const activeNow = reposActiveInWindow(stats, repoSet, period, 'current')
  const activePrior = reposActiveInWindow(stats, repoSet, period, 'prior')
  const sample = selectSampleWithFallback(activeNow, repoSet)
  // B3: mirror grades.ts calcIntegrityGrade — quiet prior window falls back to the full set
  // so highPrior/lowPrior aren't trivially 0 and the bullets don't claim phantom improvement.
  const priorSample = selectSampleWithFallback(activePrior, repoSet)

  const nowSlugs = new Set(sample.map(r => r.githubSlug))
  const priorSlugs = new Set(priorSample.map(r => r.githubSlug))

  const added = sample.filter(r => !priorSlugs.has(r.githubSlug))
  const dropped = priorSample.filter(r => !nowSlugs.has(r.githubSlug))

  const lowAdded = added.filter(r => r.builderIntegrity.pct < 60 && r.builderIntegrity.letter !== '—')
  const highDropped = dropped.filter(r => r.builderIntegrity.pct >= 80)

  const bullets: string[] = []

  if (newArrivalCount && newArrivalCount > 0) {
    bullets.push(
      `${newArrivalCount} project${newArrivalCount === 1 ? '' : 's'} newly entered this sample — see New arrivals →`,
    )
  } else if (added.length) {
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
      `Higher-scoring projects that were busy before went quiet (${formatRepoNames(highDropped, stats, period, 2)}).`,
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
    bullets.push('Rubric scores look about the same as the prior window.')
  }

  const trendLabel = formatTrendDelta(pct, priorPct, period)
  const headline =
    trend === 'up'
      ? `Standards rose (${trendLabel}) — the busiest repos scored higher on safety, testing, and transparency.`
      : trend === 'down'
        ? `Standards dipped (${trendLabel}) — more commit weight landed on repos with weaker rubric scores.`
        : `Standards held steady (${trendLabel}) — similar rubric quality where commits landed.`

  return { headline, bullets: bullets.slice(0, 4) }
}

function shippingLeveragePct(repo: Repo): number | null {
  return getShippingLeverage(repo)?.pct ?? null
}

export function buildShippingLeverageTrendExplanation(
  stats: GitHubStats,
  period: Period,
  repoSet: Repo[],
  pct: number,
  priorPct: number | null,
  trend: TrendDirection,
): TrendExplanation {
  const leverageSet = shippingLeverageRepos(repoSet)
  const activeNow = reposActiveInWindow(stats, leverageSet, period, 'current')
  const activePrior = reposActiveInWindow(stats, leverageSet, period, 'prior')
  const sample = selectSampleWithFallback(activeNow, leverageSet)
  const priorSample = selectSampleWithFallback(activePrior, leverageSet)

  const nowSlugs = new Set(sample.map(r => r.githubSlug))
  const priorSlugs = new Set(priorSample.map(r => r.githubSlug))

  const added = sample.filter(r => !priorSlugs.has(r.githubSlug))
  const dropped = priorSample.filter(r => !nowSlugs.has(r.githubSlug))

  const lowAdded = added.filter(r => {
    const sl = shippingLeveragePct(r)
    return sl != null && sl < 60
  })
  const highDropped = dropped.filter(r => {
    const sl = shippingLeveragePct(r)
    return sl != null && sl >= 80
  })

  const bullets: string[] = []

  if (added.length) {
    const names = formatRepoNames(added, stats, period, 2)
    bullets.push(
      `Infrastructure projects entered the sample${names ? `, including ${names}` : ''}.`,
    )
  }

  if (lowAdded.length && bullets.length < 4) {
    bullets.push(
      `Some newly active tooling repos score lower on shipping leverage (${formatRepoNames(lowAdded, stats, period, 2)}).`,
    )
  }

  if (highDropped.length && bullets.length < 4) {
    bullets.push(
      `Higher-leverage projects that were busy before went quiet (${formatRepoNames(highDropped, stats, period, 2)}).`,
    )
  }

  const topByCommits = topReposByCommits(stats, repoSet, period, 'current', 3, showsEconomicNa)
  if (topByCommits.length && bullets.length < 4) {
    bullets.push(`Most infrastructure work landed on ${formatRepoLeaders(topByCommits, 2)}.`)
  }

  const holderFacingNow = repoSet.filter(r => isHolderFacingTag(effectiveTag(r)))
  const totalCommitsNow = totalCommitsInWindow(stats, repoSet, period, 'current')
  const holderCommitsNow = totalCommitsInWindow(stats, holderFacingNow, period, 'current')
  if (totalCommitsNow > 0 && bullets.length < 4) {
    const holderShare = Math.round((holderCommitsNow / totalCommitsNow) * 100)
    if (holderShare < 20) {
      bullets.push(
        `Only about ${holderShare}% of commits this window landed on holder-facing apps — most shipping was behind-the-scenes tooling, which is what this grade tracks.`,
      )
    }
  }

  const highNow = sample.filter(r => (shippingLeveragePct(r) ?? 0) >= 80).length
  const highPrior = priorSample.filter(r => (shippingLeveragePct(r) ?? 0) >= 80).length
  const lowNow = sample.filter(r => {
    const sl = shippingLeveragePct(r)
    return sl != null && sl < 60
  }).length
  const lowPrior = priorSample.filter(r => {
    const sl = shippingLeveragePct(r)
    return sl != null && sl < 60
  }).length

  if ((highNow > highPrior || lowNow < lowPrior) && bullets.length < 4) {
    bullets.push(
      'More of the active infrastructure set multiplies shipping capacity or connects clearly to holder value.',
    )
  } else if ((lowNow > lowPrior || highNow < highPrior) && bullets.length < 4) {
    bullets.push(
      'More of the visible infrastructure work shifted toward repos with a weaker path to holder value.',
    )
  }

  if (!bullets.length) {
    bullets.push('Shipping-leverage rubric scores look about the same as the prior window.')
  }

  const trendLabel = formatTrendDelta(pct, priorPct, period)
  const headline =
    trend === 'up'
      ? `Shipping leverage rose (${trendLabel}) — the busiest infrastructure repos scored higher on multiplying holder value.`
      : trend === 'down'
        ? `Shipping leverage dipped (${trendLabel}) — more commit weight landed on weaker infrastructure rubric scores.`
        : `Shipping leverage held steady (${trendLabel}) — similar leverage quality where infrastructure commits landed.`

  return { headline, bullets: bullets.slice(0, 4) }
}
