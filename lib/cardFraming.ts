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

export function economicSectionFraming(repo: Repo): string | null {
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
