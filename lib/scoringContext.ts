/** Bumped when scoring inputs change (ecosystem context, evidence grounding, etc.). Stored on each score so stale rows are distinguishable; refresh via TTL/rescore — no mandatory cache flush. */
export const SCORING_CONTEXT_VERSION = 2

/**
 * Cache flush log — MOST RECENT FIRST. A "flush" clears cached autoscores/digests so every repo
 * re-scores against the CURRENT prompt + context on the next scan. This is the source of truth for
 * "how fresh is the live scoring data?" — agents and humans can reason from it instead of guessing.
 *
 * WHEN YOU FLUSH THE CACHE, ADD AN ENTRY HERE (date is America/New_York calendar day).
 * Anything scored on/after the top date reflects the current scoring code, not stale baselines.
 */
export const CACHE_FLUSH_LOG = [
  {
    date: '2026-07-06',
    note: 'Full autoscore + digest flush. All live scores re-derived on/after this date. Since the shipping-leverage rubric landed Jul 3, the whole infra/indirect/theoretical (leverage) pool now carries genuine shippingLeverage scores — not token-mechanic approximations. No manual rescore needed for leverage accuracy.',
  },
] as const

/** Most recent cache-flush date (YYYY-MM-DD, America/New_York), or null if none recorded. */
export const LAST_CACHE_FLUSH: string | null = CACHE_FLUSH_LOG[0]?.date ?? null

export function formatScoringContextLabel(version: number | null | undefined): string {
  if (version == null || version < 1) return 'legacy context'
  return `context v${version}`
}

export function scoringContextTooltip(version: number | null | undefined): string {
  const label = formatScoringContextLabel(version)
  return `Scored against ${label}. See /how-we-score#context for the background the AI read.`
}
