import { getEffectiveTag } from './criticalPath'
import { showsEconomicNa } from './economicGrade'
import type { Repo } from './scores'

/** One-line framing under expanded rubric sections — quick glance vs detail rows. */
export function integritySectionFraming(repo: Repo): string | null {
  if (showsEconomicNa(repo)) {
    return 'Safety and transparency for this repo type — not scored like a burn app or on-chain product. Expand rows for detail.'
  }
  if (getEffectiveTag(repo) === 'supply-lock') {
    return 'Did the lock hold and stay verifiable? Quiet after launch can be success.'
  }
  return 'Accountability on stated vision, safety, and follow-through for holder-facing repos.'
}

/** Expanded scorecard section title — siblings, not umbrella + lens. */
export function economicSectionTitle(repo: Repo): string {
  return showsEconomicNa(repo) ? 'Shipping leverage' : 'Holder economics'
}

export function economicSectionFraming(repo: Repo): string | null {
  if (showsEconomicNa(repo)) {
    return 'Indirect holder value — how much this repo multiplies the builder\'s ability to ship consumer apps that burn or lock CLAWD. Rolls up into the Shipping leverage Ecosystem Grade at the top — a sibling lens to Holder economics.'
  }
  if (getEffectiveTag(repo) === 'supply-lock') {
    return 'CLAWD lock / supply impact — CV burns are not CLAWD burns. Expand rows for detail.'
  }
  if (getEffectiveTag(repo) === 'direct') {
    return 'Direct CLAWD burn or lock on use — expand rows for detail.'
  }
  return null
}

export function integrityGradeFootnote(): string {
  return 'All tracked repos, commit-weighted — infra scored on infra-appropriate standards criteria.'
}

export function builderActivityGradeFootnote(): string {
  return 'Fixed targets tuned to this org\'s recent pace — velocity vs benchmarks, not repo quality.'
}
