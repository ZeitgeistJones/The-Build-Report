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

export function criticalPathTooltip(roleBadge: string): string {
  return `${roleBadge} — locked tag on the builder critical path. Floor grades at C when functioning as designed.`
}
