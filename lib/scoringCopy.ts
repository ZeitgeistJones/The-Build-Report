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
    body: `Same live AI pass, triggered when someone pays 0.000008 ETH. Result is cached for everyone. First rescore on a baseline card often shifts the letter — different method, not always a repo change overnight.`,
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

export const RESCORE_BUTTON_TOOLTIP =
  'Score this repo using Claude AI. Cost: 0.000008 ETH. Payment goes to the receiver-buy-and-burn contract; CLAWD is burned when execute() runs. Result is cached for everyone.'

export const SCORE_TYPE_BASELINE_LABEL = 'Baseline'
export const SCORE_TYPE_LIVE_AI_LABEL = 'Live AI'

export const SCORE_TYPE_BASELINE_TOOLTIP =
  'Launch baseline — fixed Jun 15 grade with cited Chronicle and tweet sources. Editorial snapshot, not re-run automatically.'

export const SCORE_TYPE_LIVE_AI_TOOLTIP =
  'Live AI — Claude inferred from repo metadata, GitHub activity, and public scoring context. Rescore can refresh it.'

export const SCORE_TYPE_STYLES = {
  baseline: {
    color: '#6b9eb8',
    bg: 'rgba(107, 158, 184, 0.14)',
    border: 'rgba(107, 158, 184, 0.35)',
  },
  liveAi: {
    color: '#a78bc9',
    bg: 'rgba(167, 139, 201, 0.14)',
    border: 'rgba(167, 139, 201, 0.35)',
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
