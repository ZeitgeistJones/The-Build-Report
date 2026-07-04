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

export const BI_PROMPT_HEADER = `builderIntegrity — ALWAYS all 5 rows (exact labels and weights):
${BI_PROMPT_ROWS}
- level: "high" | "mid" | "low"
- source: brief inference note (plain English — holders read this)`

/** direct + default consumer apps */
export const BI_CONSUMER_RULES = `BI rules for direct (burn apps):
- On-chain: score verifiable burn/lock mechanics and contract constraints.
- User safety: score how user funds flow and fail-safe behavior.
- Transparency: public repos and clear docs score mid+; obscured routing scores low.
- Governance alignment: does the app serve the "every consumer app burns CLAWD" mandate?
- Security/testing: money-moving repos need evidence of rigor; rapid ships without tests score mid not auto-low unless negligent.`

/** infrastructure, indirect, theoretical — same yardstick problem as shipping leverage */
export const BI_SHIPPING_LEVERAGE_RULES = `BI rules for indirect, infrastructure, and theoretical (shipping-leverage repos):
Do NOT score these like burn apps or on-chain products. Missing burns, staking, or contracts is EXPECTED.

- On-chain commitments: No contract in repo → mid for appropriate architectural restraint; high if credential/session boundaries are thoughtful; low ONLY for reckless secret handling or false on-chain claims. Critical-path shipping infra (clawd-harness, clawd-containers, nerve-cord, dead-simple-agent, ethskills) with active maintenance: prefer mid–high, never low solely for "no contract."
- User funds / safety: Pure dev tools with no user funds → mid default; high if API keys/sessions handled carefully; low only for careless credential exposure.
- Transparency: Public repo + documented purpose → mid minimum; high if scope and lineage are clear.
- Governance / ecosystem alignment: Low is the WRONG default — mid if repo supports autonomous-builder thesis; high for critical-path multipliers; low only if misleading about CLAWD role or actively misaligned.
- Security / testing: Active tools → mid for reasonable dev practice; low only for obvious negligence. Quiet R&D without users is not auto-low.

Never assign low on a row only because the repo lacks holder-facing UI, token mechanics, or on-chain code.`

export const BI_SUPPLY_LOCK_RULES = `BI rules for supply-lock (add to consumer rules when tag is supply-lock):
- Completed vesting/locks with tokens still locked: quiet GitHub is SUCCESS, not abandonment.
- On-chain / safety: score whether the lock held and schedule is verifiable — not whether commits continue.
- Security / testing: lack of ongoing test suites after a fulfilled launch promise → mid, not low, unless behavior contradicts the lock.`

export const BI_PROMPT = `${BI_PROMPT_HEADER}

After choosing tag, apply the matching BI block:
- direct → consumer rules
- supply-lock → consumer rules + supply-lock rules
- indirect | infrastructure | theoretical → shipping-leverage BI rules (not consumer rules)`
