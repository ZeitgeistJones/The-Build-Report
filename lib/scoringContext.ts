/** Bumped when DEFAULT_ECOSYSTEM_CONTEXT or scoring philosophy text meaningfully changes. Flush + regen after bump. */
export const SCORING_CONTEXT_VERSION = 1

export function formatScoringContextLabel(version: number | null | undefined): string {
  if (version == null || version < 1) return 'legacy context'
  return `context v${version}`
}

export function scoringContextTooltip(version: number | null | undefined): string {
  const label = formatScoringContextLabel(version)
  return `Scored against ${label}. See /context for the background the AI read.`
}
