import type { Tag } from './scores'
import type { RepoLifecycle } from './repoLifecycle'

export const CLAWD_CV_PERKS_TOOLTIP =
  'Repos where holders need CLAWD or CV to unlock perks — staking, governance, gated apps, and access flows.'

export const COMMUNITY_CONTEXT_FILTER_TOOLTIP =
  'Repos where holders left community context or voted on it. Newest activity rises to the top.'

export const REPO_FILTER_TOOLTIPS = {
  all: 'Every tracked repo in the ecosystem.',
  'needs-rescore': 'Scored repos with new GitHub commits since the last score — rescore (or promo) may apply.',
  'recently-rescored':
    'Repos that received a live Score or Rescore in the selected window — useful for checking what fed The Needle.',
  'new-arrivals': 'Repos created on GitHub in the selected window.',
  'holder-economics': 'Direct-burn and supply-lock repos — the Holder economics sample.',
  'shipping-leverage':
    'Indirect, infrastructure, and theoretical repos scored on how much they help holder-facing apps ship.',
  'clawd-cv-perks': CLAWD_CV_PERKS_TOOLTIP,
  'community-context': COMMUNITY_CONTEXT_FILTER_TOOLTIP,
} as const

export const REPO_SORT_TOOLTIPS = {
  recent: 'Sorted by last GitHub push — newest activity first.',
  commits: 'Sorted by commit count in the selected window.',
  'needs-rescore': 'Sorted by commits since the last score — most outdated first.',
  grade: 'Sorted by overall rubric grades — highest first.',
} as const

export const REPO_SCOPE_TOOLTIPS = {
  active: 'Only repos with at least one commit in the selected window.',
  all: 'Every repo in this filter, including quiet ones with zero commits.',
} as const

export const PERIOD_TOOLTIPS: Record<'24h' | '7d' | '30d' | '60d', string> = {
  '24h': 'Activity in the last 24 hours.',
  '7d': 'Activity in the last 7 days.',
  '30d': 'Activity in the last 30 days.',
  '60d': 'Activity in the last 60 days.',
}

export const TAG_TOOLTIPS: Record<Tag, string> = {
  direct: 'Consumer app with a direct CLAWD burn or lock mechanic on use.',
  'supply-lock': 'Removes CLAWD from circulation temporarily (staking, vesting, locks).',
  indirect: 'Enables other repos that burn CLAWD — scored on shipping leverage, not direct burn.',
  infrastructure: 'Foundational tooling — scored on shipping leverage, not direct CLAWD mechanic.',
  theoretical: 'R&D or early-stage — no live holder mechanic yet.',
}

export const LIFECYCLE_TOOLTIPS: Record<RepoLifecycle, string> = {
  shipping: 'At least one commit in the selected activity window.',
  stable: 'No commits this window — normal for infra, waiting burns, and supply locks.',
  done: 'Completed supply-lock promise held with strong integrity — quiet is success.',
}

export const AWAITING_SCORE_TOOLTIP =
  'Recently pushed on GitHub but not scored yet. Pay to run Live AI for rubric grades.'

export const HOLDER_ECONOMICS_COLUMN_TOOLTIP =
  'This repo\'s holder economic impact. Direct-burn and supply-lock repos are scored on their direct CLAWD burn or lock mechanic and feed the Ecosystem Grade for Holder economics at the top. Infrastructure, indirect, and theoretical repos are scored on shipping leverage instead — they feed the separate Shipping leverage Ecosystem Grade, the second lens on holder value at the top.'

export const BUILDER_STANDARDS_COLUMN_TOOLTIP =
  'Observable safety, testing, and transparency for this repo — scored on every tracked project. Rubric rows vary by repo type (consumer apps vs infra/tooling). Feeds the Builder standards Ecosystem Grade at the top.'

export function criticalPathTooltip(roleBadge: string): string {
  return `${roleBadge} — locked tag on the builder critical path. Floor grades at C when functioning as designed.`
}

export function commitsColumnTooltip(windowLabel: string, count: number | null, capped = false): string {
  if (count === null) {
    return `Commit count not scanned yet for the ${windowLabel}. Data refreshes on the daily cron or admin scan.`
  }
  const displayCount = capped && count >= 100 ? '100+' : String(count)
  const activity =
    count === 0
      ? `No commits in the ${windowLabel}.`
      : `${displayCount} commit${count === 1 && !capped ? '' : 's'} in the ${windowLabel}.`
  const capNote =
    capped && count >= 100
      ? ' GitHub scan caps at 100 commits per repo per refresh — actual count may be higher.'
      : ''
  return `${activity}${capNote}`
}

export function formatPeriodCommitDisplay(count: number | null, commitsCapped?: boolean | null): string {
  if (count === null) return '—'
  if (commitsCapped && count >= 100) return '100+'
  return String(count)
}
