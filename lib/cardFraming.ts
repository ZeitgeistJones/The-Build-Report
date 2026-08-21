import { getEffectiveTag } from './criticalPath'
import { showsEconomicNa } from './economicGrade'
import type { Repo, RubricRow } from './scores'

/** Shipping-leverage row that answers “how does this help $CLAWD holders?” */
export const HOLDER_PATH_LABEL = 'Downstream path to holder value'

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
 * Promote the “Downstream path to holder value” source as a card lead.
 * Prefer Plain English rewrite when requested.
 */
export function holderCareLeadFromRubric(
  rows: RubricRow[] | undefined,
  plain = false,
): string | null {
  if (!rows?.length) return null
  const row = rows.find(r => r.label === HOLDER_PATH_LABEL)
  if (!row) return null
  const plainSource = row.sourceNormie?.trim()
  const technical = row.source?.trim()
  const text = (plain && plainSource) || technical
  return text || null
}

/** Put the holder-path row first so the SL column matches the lead. */
export function orderShippingLeverageRowsForDisplay(rows: RubricRow[]): RubricRow[] {
  const path = rows.filter(r => r.label === HOLDER_PATH_LABEL)
  const rest = rows.filter(r => r.label !== HOLDER_PATH_LABEL)
  return path.length ? [...path, ...rest] : rows
}

export function integrityGradeFootnote(): string {
  return 'All tracked repos, commit-weighted — infra scored on infra-appropriate standards criteria.'
}

export function builderActivityGradeFootnote(): string {
  return 'Fixed targets tuned to this org\'s recent pace — velocity vs benchmarks, not repo quality.'
}
