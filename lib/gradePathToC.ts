import type { IntegrityGrade } from './grades'

const C_THRESHOLD_PCT = 73

const SIGNAL_ANCHOR: Record<string, { anchor: string; label: string }> = {
  'On-chain commitments': { anchor: 'bi-on-chain', label: 'on-chain commitments' },
  'User safety': { anchor: 'bi-safety', label: 'user safety' },
  Transparency: { anchor: 'bi-transparency', label: 'transparency' },
  'Governance & alignment': { anchor: 'bi-governance', label: 'governance & alignment' },
  'Security & testing': { anchor: 'bi-security', label: 'security & testing' },
}

export interface PathToCHint {
  distancePct: number
  anchor: string
  rowLabel: string
}

/** One-line hint when grade is below C — distance + weakest rubric row link. */
export function buildPathToC(grade: IntegrityGrade): PathToCHint | null {
  if (grade.pct >= C_THRESHOLD_PCT) return null

  const candidates = grade.signals.filter(
    s => s.label !== 'High-standards share' && SIGNAL_ANCHOR[s.label],
  )
  if (!candidates.length) return null

  const weakest = [...candidates].sort((a, b) => a.pct - b.pct)[0]
  const mapped = SIGNAL_ANCHOR[weakest.label]
  if (!mapped) return null

  return {
    distancePct: C_THRESHOLD_PCT - grade.pct,
    anchor: mapped.anchor,
    rowLabel: mapped.label,
  }
}
