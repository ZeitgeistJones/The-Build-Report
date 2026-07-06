import { commitsInWindow, effectiveTag } from './scoringShared'
import { computeRepoLifecycle, type RepoLifecycle } from './repoLifecycle'
import { hasShippingLeverageTag } from './rubrics/shippingLeverage'
import { isUnscoredRecent } from './recentRepos'
import type { GitHubStats } from './github'
import type { Period } from './grades'
import type { Repo } from './scores'

export interface EcosystemPulse {
  reposScored: number
  shipping: number
  stable: number
  done: number
  consumerApps: number
  infraTools: number
  commitsInWindow: number
}

function ecosystemCommits(stats: GitHubStats, period: Period): number {
  if (period === '60d') return stats.totalCommits30d + stats.totalCommits30_60
  if (period === '30d') return stats.totalCommits30d
  if (period === '24h') return stats.totalCommits24h ?? 0
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
    stable: 0,
    done: 0,
  }
  let consumerApps = 0
  let infraTools = 0

  for (const repo of scored) {
    const tag = effectiveTag(repo)
    if (hasShippingLeverageTag(tag)) infraTools++
    else consumerApps++

    const live = stats?.repoActivity[repo.githubSlug]
    const commits = live ? commitsInWindow(live, period, 'current') : 0
    const lifecycle = computeRepoLifecycle(repo, commits)
    counts[lifecycle]++
  }

  return {
    reposScored: scored.length,
    shipping: counts.shipping,
    stable: counts.stable,
    done: counts.done,
    consumerApps,
    infraTools,
    commitsInWindow: stats ? ecosystemCommits(stats, period) : 0,
  }
}

export function ecosystemPulseSummary(pulse: EcosystemPulse, period: Period): string {
  const window =
    period === '60d'
      ? 'the last 60 days'
      : period === '30d'
        ? 'the last 30 days'
        : period === '24h'
          ? 'the last 24 hours'
          : 'the last 7 days'
  const parts: string[] = []
  if (pulse.shipping > 0) parts.push(`${pulse.shipping} shipping`)
  if (pulse.stable > 0) parts.push(`${pulse.stable} stable`)
  if (pulse.done > 0) parts.push(`${pulse.done} done`)
  const breakdown = parts.length ? parts.join(', ') : 'no scored repos'
  return `${pulse.reposScored} repos scored · ${breakdown} · ${pulse.commitsInWindow.toLocaleString()} commits ${window}. Burn-app economic grades exclude infra.`
}
