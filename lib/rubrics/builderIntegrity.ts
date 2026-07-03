import type { Level, RubricRow } from '@/lib/scores'

export const BI_ROW_LABELS = [
  'On-chain commitments and constraints',
  'User funds, risk, and safety posture',
  'Transparency and verifiability',
  'Governance, token-economics, and ecosystem alignment',
  'Security, testing, and cryptographic rigor',
] as const

export type BiRowLabel = (typeof BI_ROW_LABELS)[number]

export const BI_WEIGHTS = new Set(['22%', '20%', '18%'])

export const BI_WEIGHT_BY_LABEL: Record<BiRowLabel, string> = {
  'On-chain commitments and constraints': '22%',
  'User funds, risk, and safety posture': '20%',
  'Transparency and verifiability': '18%',
  'Governance, token-economics, and ecosystem alignment': '20%',
  'Security, testing, and cryptographic rigor': '20%',
}

/** Legacy 3-row labels — used for ecosystem-grade signals on older cached scores. */
export const LEGACY_BI_LABELS = [
  'Serves stated vision at time of build',
  'Genuine autonomous build',
  'Passes walkaway test',
] as const

export function isNewBuilderIntegrityRubric(rows: RubricRow[]): boolean {
  return rows.length === 5 && rows.some(r => r.label === BI_ROW_LABELS[0])
}

function levelToPct(level: Level): number {
  if (level === 'high') return 100
  if (level === 'mid') return 67
  return 33
}

function parseWeight(w: string): number {
  if (w === 'equal') return 0.2
  const n = parseFloat(w)
  return Number.isFinite(n) ? n / 100 : 0
}

/** v2 BI: weighted sum of row scores (high=100, mid=67, low=33). */
export function calcBuilderIntegrityPct(rows: RubricRow[]): number {
  if (!rows.length) return 0

  if (isNewBuilderIntegrityRubric(rows)) {
    let total = 0
    for (const row of rows) {
      total += parseWeight(row.weight) * levelToPct(row.level)
    }
    return Math.round(total)
  }

  // Legacy 3-row rubric (40/35/25): same ÷3 formula as token mechanic.
  const levelMap: Record<Level, number> = { high: 3, mid: 2, low: 1 }
  let total = 0
  for (const row of rows) {
    total += parseWeight(row.weight) * levelMap[row.level]
  }
  return Math.round((total / 3) * 100)
}

export function validateBuilderIntegrityRows(rows: unknown[]): rows is RubricRow[] {
  if (!Array.isArray(rows) || rows.length !== 5) return false
  const labels = new Set(rows.map(r => (r as RubricRow).label))
  if (!BI_ROW_LABELS.every(l => labels.has(l))) return false

  return rows.every(r => {
    if (typeof r !== 'object' || r === null) return false
    const row = r as RubricRow
    return (
      typeof row.label === 'string' &&
      typeof row.source === 'string' &&
      BI_WEIGHTS.has(row.weight) &&
      (row.level === 'high' || row.level === 'mid' || row.level === 'low') &&
      row.weight === BI_WEIGHT_BY_LABEL[row.label as BiRowLabel]
    )
  })
}

export const BI_PROMPT_ROWS = BI_ROW_LABELS.map(label => {
  const weight = BI_WEIGHT_BY_LABEL[label]
  return `- "${label}" (${weight})`
}).join('\n')
