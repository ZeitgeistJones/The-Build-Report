import { showsEconomicNa } from './economicGrade'
import type { Repo } from './scores'

/** One-line framing under expanded rubric sections — quick glance vs detail rows. */
export function integritySectionFraming(repo: Repo): string | null {
  if (showsEconomicNa(repo)) {
    return 'Trust and safety for this repo type — not scored like a burn app or on-chain product. Expand rows for detail.'
  }
  if (repo.tag === 'supply-lock') {
    return 'Did the lock hold and stay verifiable? Quiet after launch can be success.'
  }
  return 'Accountability on stated vision, safety, and follow-through for holder-facing repos.'
}

export function integrityGradeFootnote(): string {
  return 'Consumer apps + supply-lock repos only — infra and R&D excluded from this average.'
}
