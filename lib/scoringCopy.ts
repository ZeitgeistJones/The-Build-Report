import { isAutoInferredNote } from './repoFilters'

export const ABOUT_SCORE_TYPES_SECTIONS = [
  {
    title: 'Launch baseline',
    body: `Fixed grades published on Jun 15, 2026. Each rubric row cites a source — a Chronicle chapter, a tweet, or a GitHub fact. A person made the final call after reviewing those primary sources. AI may have helped with research, but these are editorial snapshots, not live automated outputs. They are not re-run automatically.`,
  },
  {
    title: 'Live AI score',
    body: `Claude runs at score time from the repo name, description, and GitHub activity. Useful for repos that did not exist at launch or have not received a baseline grade. Lower confidence, and rubric rows do not carry row-by-row Chronicle citations. Treat as a starting-point estimate.

Early live AI scores used repo metadata and a short ecosystem summary only. Paid Rescores can now optionally include condensed Chronicle context that an admin pastes in — when that is set. That is still not the same as baseline row-by-row citations. Older and newer Live AI grades may not be directly comparable even though both show the same badge.`,
  },
  {
    title: 'Rescore',
    body: `The same live AI pass, triggered on demand when someone pays. The result is cached and shared with everyone. Rescore compares against whatever grade was there before — usually the launch baseline on first run. Rescore today uses the current live AI method, which may include optional Chronicle context if the admin has configured it — not a re-review of the baseline.

First rescore on a baseline grade often moves the letter by a lot. That usually means a different scoring pass and a newer date, not that the repo changed overnight. Later rescores tend to move less because they compare AI-to-AI.`,
  },
] as const

export const ABOUT_SCORE_TYPES_CALLOUT =
  'Both baseline and live AI scoring can involve Claude. Baseline is a fixed, source-cited snapshot. Live AI is on-demand inference — and the prompt has improved since launch.'

export const ABOUT_LIVE_AI_EVOLUTION_CALLOUT =
  'Cards show two types: Baseline and Live AI. Live AI is one badge, but the method behind it got better over time. We are not re-running old scores — Rescore only affects the repo you pay for.'

export const RESCORE_SUMMARY_NOTE =
  'Rescore uses live AI on today\'s repo data — different from the launch baseline.'

export const CONFIDENCE_LABEL = {
  high: 'High confidence',
  mid: 'Medium confidence',
  low: 'Low confidence',
} as const

export const BASELINE_CONFIDENCE_TOOLTIP =
  'Launch baseline. Published Jun 15 with cited Chronicle and tweet sources. Editorial snapshot — not re-run automatically.'

export const LIVE_AI_CONFIDENCE_TOOLTIP =
  'Live AI inference from repo metadata. Newer Rescores may include optional Chronicle context; older ones did not. Still not the same as a baseline grade — Rescore can refresh it.'

export const RESCORE_BUTTON_TOOLTIP =
  'Score this repo using Claude AI. Cost: 0.000008 ETH (~$0.02 at time of writing — ETH price fluctuates so actual USD cost may vary). Payment is burned as $CLAWD via the receiver-buy-and-burn contract, supporting the ecosystem. Result is cached — community benefits from your score. First rescore on a baseline grade often shifts the letter — different scoring pass, not always a repo change.'

export const SCORE_TYPE_BASELINE_LABEL = 'Baseline'
export const SCORE_TYPE_LIVE_AI_LABEL = 'Live AI'

export const SCORE_TYPE_BASELINE_TOOLTIP =
  'Launch baseline — fixed Jun 15 grade with cited Chronicle and tweet sources. Editorial snapshot, not re-run automatically.'

export const SCORE_TYPE_LIVE_AI_TOOLTIP =
  'Live AI score — Claude inferred this from repo metadata and GitHub activity. Newer paid Rescores may include optional Chronicle context; older ones did not. Still not the same as baseline — Rescore can refresh it.'

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

export function isLaunchBaseline(adminNote: string | undefined): boolean {
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
