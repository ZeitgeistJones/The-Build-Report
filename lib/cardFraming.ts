import { getEffectiveTag } from './criticalPath'
import { showsEconomicNa } from './economicGrade'
import type { Repo, RubricRow } from './scores'

/** Shipping-leverage row that answers “how does this help $CLAWD holders?” */
export const HOLDER_PATH_LABEL = 'Downstream path to holder value'

/** Holder-economics row that traces the CLAWD effect for holders. */
export const HOLDER_RELEVANCE_LABEL = 'Mechanism clarity and holder relevance'

/** Prefer these labels (in order) when promoting a “Why holders care” lead. */
export const HOLDER_CARE_LEAD_LABELS = [
  HOLDER_PATH_LABEL,
  HOLDER_RELEVANCE_LABEL,
  'Direct CLAWD economic impact',
  'Revenue or burn path built in', // legacy TM
] as const

export type HolderCareLead = {
  text: string
  sourceLabel: string
}

/** One-line framing under expanded rubric sections — quick glance vs detail rows. */
export function integritySectionFraming(repo: Repo, plain = false): string | null {
  if (showsEconomicNa(repo)) {
    return plain
      ? 'How safe and clear this kind of tool is — not graded like a burn app.'
      : 'Safety and transparency for this repo type — not scored like a burn app or on-chain product.'
  }
  if (getEffectiveTag(repo) === 'supply-lock') {
    return plain
      ? 'Did the lock hold, and can people check it? Quiet afterward can mean the job is done.'
      : 'Did the lock hold and stay verifiable? Quiet after launch can be success.'
  }
  return plain
    ? 'Did they build what they said, safely, and follow through?'
    : 'Accountability on stated vision, safety, and follow-through for holder-facing repos.'
}

/** Expanded scorecard section title — siblings, not umbrella + lens. */
export function economicSectionTitle(repo: Repo): string {
  return showsEconomicNa(repo) ? 'Shipping leverage' : 'Holder economics'
}

export function economicSectionFraming(repo: Repo, plain = false): string | null {
  if (showsEconomicNa(repo)) {
    return plain
      ? 'Does this help builders ship apps that burn or lock CLAWD? Feeds the Shipping leverage grade at the top.'
      : 'Indirect holder value — how much this repo multiplies the builder\'s ability to ship consumer apps that burn or lock CLAWD. Rolls up into the Shipping leverage Ecosystem Grade at the top — a sibling lens to Holder economics.'
  }
  if (getEffectiveTag(repo) === 'supply-lock') {
    return plain
      ? 'CLAWD locked up (not the same as burning CV).'
      : 'CLAWD lock / supply impact — CV burns are not CLAWD burns.'
  }
  if (getEffectiveTag(repo) === 'direct') {
    return plain
      ? 'Using it burns or locks CLAWD directly.'
      : 'Direct CLAWD burn or lock on use.'
  }
  return null
}

/**
 * Promote the best holder-path / holder-relevance source as a card lead.
 * Works for shipping leverage and holder economics rubrics.
 */
export function holderCareLeadFromRubric(
  rows: RubricRow[] | undefined,
  plain = false,
): HolderCareLead | null {
  if (!rows?.length) return null
  for (const label of HOLDER_CARE_LEAD_LABELS) {
    const row = rows.find(r => r.label === label)
    if (!row) continue
    const plainSource = row.sourceNormie?.trim()
    const technical = row.source?.trim()
    const text = (plain && plainSource) || technical
    if (text) return { text, sourceLabel: label }
  }
  return null
}

/** Put the promoted lead row first so the economic column matches the callout. */
export function orderEconomicRowsForDisplay(
  rows: RubricRow[],
  leadLabel: string | null,
): RubricRow[] {
  if (!leadLabel) return rows
  const lead = rows.filter(r => r.label === leadLabel)
  const rest = rows.filter(r => r.label !== leadLabel)
  return lead.length ? [...lead, ...rest] : rows
}

/** @deprecated Prefer orderEconomicRowsForDisplay — kept for call-site clarity on SL. */
export function orderShippingLeverageRowsForDisplay(rows: RubricRow[]): RubricRow[] {
  return orderEconomicRowsForDisplay(rows, HOLDER_PATH_LABEL)
}

export function integrityGradeFootnote(): string {
  return 'All tracked repos, commit-weighted — infra scored on infra-appropriate standards criteria.'
}

export function builderActivityGradeFootnote(): string {
  return 'Fixed targets tuned to this org\'s recent pace — velocity vs benchmarks, not repo quality.'
}
