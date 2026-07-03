import { getEffectiveTag } from './criticalPath'
import { computeRepoLifecycle, type RepoLifecycle } from './repoLifecycle'
import { hasShippingLeverageTag } from './rubrics/shippingLeverage'
import { isUnscoredRecent } from './recentRepos'
import type { GitHubStats } from './github'
import type { Period } from './grades'
import type { Repo } from './scores'

export interface EcosystemPulse {
  reposScored: number
  shipping: number
  supporting: number
  done: number
  dormant: number
  consumerApps: number
  infraTools: number
  commitsInWindow: number
}

function commitsForRepo(
  stats: GitHubStats,
  slug: string,
  period: Period,
): number {
  const live = stats.repoActivity[slug]
  if (!live) return 0
  if (period === '60d') return live.commits30d + live.commits30_60
  if (period === '30d') return live.commits30d
  return live.commits7d
}

function ecosystemCommits(stats: GitHubStats, period: Period): number {
  if (period === '60d') return stats.totalCommits30d + stats.totalCommits30_60
  if (period === '30d') return stats.totalCommits30d
  return stats.totalCommits7d
}

export function calcEcosystemPulse(
  repos: Repo[],
  stats: GitHubStats | null,
  period: Period,
): EcosystemPulse {
  const scored = repos.filter(r => !isUnscoredRecent(r))
  const counts: Record<RepoLifecycle, number> = {
    shipping: 0,
    supporting: 0,
    done: 0,
    dormant: 0,
  }
  let consumerApps = 0
  let infraTools = 0

  for (const repo of scored) {
    const tag = getEffectiveTag(repo)
    if (hasShippingLeverageTag(tag)) infraTools++
    else consumerApps++

    const commits = stats ? commitsForRepo(stats, repo.githubSlug, period) : 0
    const lifecycle = computeRepoLifecycle(repo, commits)
    counts[lifecycle]++
  }

  return {
    reposScored: scored.length,
    shipping: counts.shipping,
    supporting: counts.supporting,
    done: counts.done,
    dormant: counts.dormant,
    consumerApps,
    infraTools,
    commitsInWindow: stats ? ecosystemCommits(stats, period) : 0,
  }
}

export function ecosystemPulseSummary(pulse: EcosystemPulse, period: Period): string {
  const window =
    period === '60d' ? 'the last 60 days' : period === '30d' ? 'the last 30 days' : 'the last 7 days'
  const parts: string[] = []
  if (pulse.shipping > 0) parts.push(`${pulse.shipping} shipping`)
  if (pulse.supporting > 0) parts.push(`${pulse.supporting} supporting infra`)
  if (pulse.done > 0) parts.push(`${pulse.done} completed`)
  if (pulse.dormant > 0) parts.push(`${pulse.dormant} dormant`)
  const breakdown = parts.length ? parts.join(', ') : 'no scored repos'
  return `${pulse.reposScored} repos scored · ${breakdown} · ${pulse.commitsInWindow.toLocaleString()} commits ${window}. Burn-app economic grades exclude infra.`
}
