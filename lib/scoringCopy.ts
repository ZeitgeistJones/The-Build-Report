import { isAutoInferredNote } from './repoFilters'

export const ABOUT_SCORE_TYPES_SECTIONS = [
  {
    title: 'Launch baseline',
    body: `Fixed grades from a Jun 15, 2026 editorial pass. Each rubric row cites a source — Chronicle chapter, tweet, or GitHub fact. These are snapshots, not re-run automatically.`,
  },
  {
    title: 'Live AI score',
    body: `Claude infers grades from repo metadata, GitHub files, and Chronicle-grounded scoring context. Rubric rows are AI-generated inference notes — not row-by-row Chronicle citations like baseline. Treat as a starting-point estimate; Rescore can refresh it.`,
  },
  {
    title: 'Rescore',
    body: `Same live AI pass, triggered when someone pays 0.000008 ETH — or, during the limited launch promo, free on stale repos with ~$0.01 per stale commit to your wallet and matching ETH queued for CLAWD burns (50/50 subsidy). Approx USD refreshes weekly from ETH price; on-chain amounts are still ETH. Result is cached for everyone. First rescore on a baseline card often shifts the letter — different method, not always a repo change overnight.`,
  },
] as const

export const ABOUT_SCORE_TYPES_CALLOUT =
  'Baseline = fixed, source-cited snapshot. Live AI = on-demand inference with public scoring context. Both can use Claude; they are not the same pass.'

export const RESCORE_SUMMARY_NOTE =
  'Rescore uses live AI on today\'s repo data — different from the launch baseline.'

export const CONFIDENCE_LABEL = {
  high: 'High confidence',
  mid: 'Medium confidence',
  low: 'Low confidence',
} as const

export const BASELINE_CONFIDENCE_TOOLTIP =
  'Launch baseline — Jun 15 editorial snapshot with cited Chronicle and tweet sources. Not re-run automatically.'

export const LIVE_AI_CONFIDENCE_TOOLTIP =
  'Live AI — Claude inferred from repo metadata, GitHub activity, and public scoring context. Rescore can refresh it.'

export const APPROX_USD_NOTE =
  'Approx USD labels use a weekly ETH price check; on-chain payment and rewards are still ETH.'

export const APPROX_USD_NOTE_SHORT = 'Approx USD refreshes weekly from ETH price.'

export const RESCORE_BUTTON_TOOLTIP =
  `Score this repo using Claude AI. Cost: ~$0.01 (0.000008 ETH). Payment goes to the receiver-buy-and-burn contract; CLAWD is burned when execute() runs. Result is cached for everyone. ${APPROX_USD_NOTE}`

export const RESCORE_PROMO_TOOLTIP =
  `Limited launch promo: earn ~$0.01 per commit to your wallet plus the same amount queued for CLAWD burns (50/50 treasury subsidy) — first Score on commits after the repo was created (forks: after the fork), or Rescore on stale scored repos. Connect a Base wallet to qualify. Promo ends when disabled or the treasury runs low. ${APPROX_USD_NOTE}`

/** Shown when a connected wallet fails CLAWDGate tier 1 (Score / Rescore). */
export const RESCORE_TOKEN_GATE_TOOLTIP =
  'Hold at least 10M $CLAWD to Score or Rescore.'

export const ECOSYSTEM_ADD_CONTEXT_LABEL =
  'Disagree with a grade? Holders can add context →'

export const ECOSYSTEM_ADD_CONTEXT_TOOLTIP =
  'Each repo card lets holders submit real-world context the AI reads on the next rescore — onchain facts, governance changes, or utility GitHub activity alone won’t show. Enough net upvotes auto-accepts it. It’s grounding for the score, not a direct override. Submitting burns a small amount of CLAWD; voting is free for holders.'

export const RESCORE_PROMO_SITE_BANNER = {
  title: 'Limited-time rescore promo',
  summary:
    'Earn ~$0.01 per commit to your wallet and the same to the burn queue (50/50 treasury subsidy) — first Score on commits after the repo was created (forks: after the fork), or Rescore on stale scored repos. Approx USD refreshes weekly from ETH price.',
  bullets: [
    'Connect on Base to use Score / Rescore.',
    'Earn on first Score for commits after the repo was created (forks: after the fork), and on Rescore when a scored repo has commits since last score.',
    '{{perCommit}} to your wallet; the other half fuels CLAWD burns when someone runs Execute burn.',
    'Promo ends when funds run low or we turn it off.',
  ],
  disclaimer:
    'Experimental launch promo — no guarantee of eligibility, reward amount, payout timing, or continued availability. Bugs, treasury limits, rate limits, or manual shutdown can change or end rewards without notice. Approx USD labels use a weekly ETH price check. Not financial advice.',
  minimizeLabel: 'Minimize',
  expandLabel: 'Show promo details',
  minimizedHint: 'Launch promo active — Score / Rescore earns ~$ rewards & burn fuel on eligible repos',
} as const

export const SCORE_TYPE_BASELINE_LABEL = 'Baseline'
export const SCORE_TYPE_LIVE_AI_LABEL = 'Live AI'

export const SCORE_TYPE_BASELINE_TOOLTIP =
  'Launch baseline — fixed Jun 15 grade with cited Chronicle and tweet sources. Editorial snapshot, not re-run automatically.'

export const SCORE_TYPE_LIVE_AI_TOOLTIP =
  'Live AI — Claude inferred from repo metadata, GitHub activity, and public scoring context. Rescore can refresh it.'

export const SCORE_TYPE_STYLES = {
  baseline: {
    color: 'var(--text-secondary)',
    bg: 'var(--surface-2)',
    border: 'var(--border)',
  },
  liveAi: {
    color: 'var(--text-secondary)',
    bg: 'var(--surface-2)',
    border: 'var(--border)',
  },
} as const

export function isLaunchBaseline(adminNote: string | null | undefined): boolean {
  return !isAutoInferredNote(adminNote)
}

export function getConfidenceTooltip(isBaseline: boolean): string {
  return isBaseline ? BASELINE_CONFIDENCE_TOOLTIP : LIVE_AI_CONFIDENCE_TOOLTIP
}

function parseScoredAt(scoredAt: string): Date | null {
  const scored = new Date(scoredAt)
  return Number.isNaN(scored.getTime()) ? null : scored
}

export function formatBaselineDate(scoredAt: string): string {
  const scored = parseScoredAt(scoredAt)
  if (!scored) return 'Jun 15 snapshot'
  const dateLabel = scored.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${dateLabel} snapshot`
}

/** Launch baseline dates use ISO (2026-06-15); live AI uses locale strings (Jun 30, 2026). */
export function looksLikeBaselineDate(scoredAt: string | null | undefined): boolean {
  if (!scoredAt) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(scoredAt.trim())
}

export function formatScoredDateLabel(scoredAt: string | null | undefined): string {
  if (!scoredAt) return 'Not scored yet'
  const d = new Date(scoredAt)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return scoredAt
}

/** Prior score date in rescore before/after — first live score has no prior timestamp. */
export function formatRescoreOldDateLabel(scoredAt: string | null | undefined): string {
  if (!scoredAt) return 'First score'
  return formatScoredDateLabel(scoredAt)
}

export const RESCORE_NOT_SCORED_LABEL = 'Not scored'
