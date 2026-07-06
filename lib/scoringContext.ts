/** Bumped when scoring inputs change (ecosystem context, evidence grounding, etc.). Stored on each score so stale rows are distinguishable; refresh via TTL/rescore — no mandatory cache flush. */
export const SCORING_CONTEXT_VERSION = 2

export function formatScoringContextLabel(version: number | null | undefined): string {
  if (version == null || version < 1) return 'legacy context'
  return `context v${version}`
}

export function scoringContextTooltip(version: number | null | undefined): string {
  const label = formatScoringContextLabel(version)
  return `Scored against ${label}. See /how-we-score#context for the background the AI read.`
}
