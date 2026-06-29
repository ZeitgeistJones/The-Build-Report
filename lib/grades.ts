import { REPOS, Tag } from './scores'
import { GitHubStats } from './github'

export type Period = '30d' | '7d'

export interface BuilderGrade {
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trend: 'up' | 'flat' | 'down'
}

export interface HolderRelevanceGrade {
  counts: { direct: number; lock: number; indirect: number; infra: number }
  letter: string
  pct: number
  summary: string
  signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  trend: 'up' | 'flat' | 'down'
}

const levelMap = { high: 3, mid: 2, low: 1 }

function toLevel(pct: number): 'high' | 'mid' | 'low' {
  if (pct >= 0.66) return 'high'
  if (pct >= 0.33) return 'mid'
  return 'low'
}

function pctToLetter(pct: number): string {
  if (pct >= 80) return 'A'
  if (pct >= 60) return 'B'
  if (pct >= 40) return 'C'
  return 'D'
}

export function calcBuilderGrade(stats: GitHubStats, period: Period): BuilderGrade {
  const commits = period === '30d' ? stats.totalCommits30d : stats.totalCommits7d
  const activeDays = period === '30d' ? stats.activeDays30d : stats.activeDays7d
  const newRepos = period === '30d' ? stats.newRepos30d : stats.newRepos7d
  const periodDays = period === '30d' ? 30 : 7

  // normalise signals 0-1
  const commitPct = Math.min(commits / (periodDays * 15), 1)
  const activePct = Math.min(activeDays / periodDays, 1)
  const newRepoPct = Math.min(newRepos / (periodDays === 30 ? 3 : 1), 1)

  // repos with new commits
  const activeRepos = Object.values(stats.repoActivity).filter(r =>
    period === '30d' ? r.commits30d > 0 : r.commits7d > 0
  ).length
  const activeRepoPct = Math.min(activeRepos / 8, 1)

  // consistency — active days spread
  const consistencyPct = activePct

  const signals = [
    { label: 'Commit frequency', pct: commitPct, level: toLevel(commitPct) },
    { label: 'Active days', pct: activePct, level: toLevel(activePct) },
    { label: 'New repos created', pct: newRepoPct, level: toLevel(newRepoPct) },
    { label: 'Repos with new commits', pct: activeRepoPct, level: toLevel(activeRepoPct) },
    { label: 'Consistency', pct: consistencyPct, level: toLevel(consistencyPct) },
  ] as const

  const avgPct = signals.reduce((s, sig) => s + sig.pct, 0) / signals.length
  const score = Math.round(avgPct * 100)

  let summary = ''
  if (score >= 80) summary = `Consistently active over the last ${period}. High commit frequency with no long gaps.`
  else if (score >= 60) summary = `Solid activity over the last ${period}. A few quieter stretches but building is ongoing.`
  else if (score >= 40) summary = `Moderate activity over the last ${period}. Building is happening but the pace has slowed.`
  else summary = `Lower than usual activity over the last ${period}. Worth watching.`

  return {
    letter: pctToLetter(score),
    pct: score,
    summary,
    signals: signals.map(s => ({ ...s, pct: Math.round(s.pct * 100) })),
    trend: stats.trend30vs30,
  }
}

export function calcHolderRelevanceGrade(stats: GitHubStats, period: Period): HolderRelevanceGrade {
  const tagOrder: Tag[] = ['direct', 'supply-lock', 'indirect', 'infrastructure', 'theoretical']
  const tagWeight: Record<Tag, number> = {
    'direct': 1.0,
    'supply-lock': 0.7,
    'indirect': 0.4,
    'infrastructure': 0.1,
    'theoretical': 0.0,
  }

  const reposByTag: Record<Tag, number> = {
    'direct': 0, 'supply-lock': 0, 'indirect': 0, 'infrastructure': 0, 'theoretical': 0
  }
  const activeByTag: Record<Tag, number> = {
    'direct': 0, 'supply-lock': 0, 'indirect': 0, 'infrastructure': 0, 'theoretical': 0
  }

  REPOS.forEach(repo => {
    const activity = stats.repoActivity[repo.githubSlug]
    const isActive = period === '30d'
      ? (activity?.commits30d ?? 0) > 0
      : (activity?.commits7d ?? 0) > 0
    reposByTag[repo.tag]++
    if (isActive) activeByTag[repo.tag]++
  })

  // weighted score based on which tag types are active
  let weightedSum = 0
  let weightedTotal = 0
  tagOrder.forEach(tag => {
    if (reposByTag[tag] > 0) {
      const activeFrac = activeByTag[tag] / reposByTag[tag]
      weightedSum += activeFrac * tagWeight[tag]
      weightedTotal += tagWeight[tag]
    }
  })

  const score = weightedTotal > 0 ? Math.round((weightedSum / weightedTotal) * 100) : 0

  const directActive = activeByTag['direct']
  const lockActive = activeByTag['supply-lock']
  const indirectActive = activeByTag['indirect']
  const infraActive = activeByTag['infrastructure']
  const theoreticalActive = activeByTag['theoretical']

  const signals = [
    { label: 'Direct burn repos active', pct: reposByTag['direct'] > 0 ? Math.round(directActive / reposByTag['direct'] * 100) : 0, level: toLevel(reposByTag['direct'] > 0 ? directActive / reposByTag['direct'] : 0) },
    { label: 'Supply lock repos active', pct: reposByTag['supply-lock'] > 0 ? Math.round(lockActive / reposByTag['supply-lock'] * 100) : 0, level: toLevel(reposByTag['supply-lock'] > 0 ? lockActive / reposByTag['supply-lock'] : 0) },
    { label: 'Indirect repos active', pct: reposByTag['indirect'] > 0 ? Math.round(indirectActive / reposByTag['indirect'] * 100) : 0, level: toLevel(reposByTag['indirect'] > 0 ? indirectActive / reposByTag['indirect'] : 0) },
    { label: 'Infrastructure repos active', pct: reposByTag['infrastructure'] > 0 ? Math.round(infraActive / reposByTag['infrastructure'] * 100) : 0, level: toLevel(reposByTag['infrastructure'] > 0 ? infraActive / reposByTag['infrastructure'] : 0) },
    { label: 'New holder-facing repos', pct: Math.min(Math.round((directActive + lockActive) / 3 * 100), 100), level: toLevel((directActive + lockActive) / 3) },
  ] as const

  let summary = ''
  if (score >= 80) summary = 'Most active repos are holder-facing right now. Burn and lock mechanics are where the building is focused.'
  else if (score >= 60) summary = 'Good mix of holder-facing and infrastructure work. Direct mechanics are live and being maintained.'
  else if (score >= 40) summary = 'Current building is weighted toward infrastructure. Direct holder mechanics are live but not the active focus.'
  else summary = 'Most active repos are infrastructure right now. Holder-facing mechanics exist but aren\'t where current building is concentrated.'

  return {
    letter: pctToLetter(score),
    pct: score,
    summary,
    signals: signals.map(s => ({ ...s })),
    counts: {
      direct: directActive,
      lock: lockActive,
      indirect: indirectActive,
      infra: infraActive,
    },
    trend: score > 50 ? 'up' : score < 30 ? 'down' : 'flat' as 'up' | 'flat' | 'down',
  }
}
