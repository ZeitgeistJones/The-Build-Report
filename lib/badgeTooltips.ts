import type { Tag } from './scores'
import type { RepoLifecycle } from './repoLifecycle'

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

export const ECONOMIC_NA_TOOLTIP =
  'Not in the burn-apps grade at the top. This repo type uses shipping leverage instead of direct CLAWD burns. Only direct and supply-lock repos feed the ecosystem economic average.'

export const SHIPPING_LEVERAGE_COLUMN_TOOLTIP =
  'How this repo multiplies holder value indirectly — display only, excluded from the burn-apps grade at the top.'

export const SUPPLY_LOCK_TM_COLUMN_TOOLTIP =
  'Scores CLAWD lock / supply impact — not CV burns. Larv.ai stakes CLAWD; burning CV is a separate token.'

export const DIRECT_TM_COLUMN_TOOLTIP =
  'Direct CLAWD burn or lock mechanic — feeds the burn-apps grade at the top.'

export function criticalPathTooltip(roleBadge: string): string {
  return `${roleBadge} — locked tag on the builder critical path. Floor grades at C when functioning as designed.`
}

export function commitsColumnTooltip(windowLabel: string, count: number): string {
  const activity =
    count === 0
      ? `No commits in the ${windowLabel}.`
      : `${count} commit${count === 1 ? '' : 's'} in the ${windowLabel}.`
  return `${activity} Sampled GitHub scan — may show 0 if the repo was not in the scan batch.`
}
