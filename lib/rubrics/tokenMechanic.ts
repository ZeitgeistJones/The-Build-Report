import type { Level, RubricRow, Tag } from '@/lib/scores'

export const TM_WEIGHTS = new Set(['50%', '30%', '20%'])

export const TM_CONSUMER_LABELS = [
  'Direct CLAWD economic impact',
  'Mechanism clarity and holder relevance',
  'Alignment with CLAWD economic story',
] as const

export const TM_INFRA_LABELS = [
  'CLAWD mechanic enablement',
  'Clarity of economic role in ecosystem',
  'Alignment with CLAWD economic story (infra)',
] as const

/** Legacy labels for commit-weighted grade signals on older scores. */
export const LEGACY_TM_LABELS = [
  'Burn mechanic exists and is live',
  'Revenue or burn path built in',
  'Mechanic is operational',
] as const

export const TM_WEIGHT_BY_LABEL: Record<string, string> = {
  'Direct CLAWD economic impact': '50%',
  'Mechanism clarity and holder relevance': '30%',
  'Alignment with CLAWD economic story': '20%',
  'CLAWD mechanic enablement': '50%',
  'Clarity of economic role in ecosystem': '30%',
  'Alignment with CLAWD economic story (infra)': '20%',
  'Burn mechanic exists and is live': '50%',
  'Revenue or burn path built in': '30%',
  'Mechanic is operational': '20%',
}

/** Claude often returns launch-baseline row names on direct/supply-lock repos — map to v3 labels. */
export const LEGACY_TM_TO_V3_LABEL: Record<string, string> = {
  'Burn mechanic exists and is live': 'Direct CLAWD economic impact',
  'Revenue or burn path built in': 'Mechanism clarity and holder relevance',
  'Mechanic is operational': 'Alignment with CLAWD economic story',
}

// NOTE: deliberately excludes 'indirect'. expectedTmLabels('indirect') must return consumer labels so autoscore.ts's recovery path (indirect repo + model-emitted consumer TM rows → scored as shipping leverage) keeps validating. Do not "fix" by adding indirect here.
export function isInfraTag(tag: Tag): boolean {
  return tag === 'infrastructure' || tag === 'theoretical'
}

export function expectedTmLabels(tag: Tag): readonly string[] {
  return isInfraTag(tag) ? TM_INFRA_LABELS : TM_CONSUMER_LABELS
}

export function isLegacyTokenMechanicRubric(rows: RubricRow[]): boolean {
  if (rows.length !== 3) return false
  const labels = rows.map(r => r.label)
  return LEGACY_TM_LABELS.every(l => labels.includes(l))
}

function rowsMatchExpectedLabels(rows: RubricRow[], expected: readonly string[]): boolean {
  const labels = rows.map(r => r.label)
  return expected.every(l => labels.includes(l))
}

function rowsHaveValidTmShape(rows: RubricRow[]): boolean {
  return rows.every(row => {
    return (
      typeof row.label === 'string' &&
      typeof row.source === 'string' &&
      TM_WEIGHTS.has(row.weight) &&
      (row.level === 'high' || row.level === 'mid' || row.level === 'low') &&
      row.weight === TM_WEIGHT_BY_LABEL[row.label]
    )
  })
}

/** Normalize legacy TM row names to v3 consumer labels (same 50/30/20 weights). */
export function normalizeTokenMechanicRows(rows: RubricRow[], tag: Tag): RubricRow[] {
  if (isInfraTag(tag) || !isLegacyTokenMechanicRubric(rows)) return rows
  return rows.map(row => {
    const label = LEGACY_TM_TO_V3_LABEL[row.label] ?? row.label
    return { ...row, label, weight: TM_WEIGHT_BY_LABEL[label] ?? row.weight }
  })
}

export function validateTokenMechanicRows(rows: unknown[], tag: Tag): rows is RubricRow[] {
  if (!Array.isArray(rows) || rows.length !== 3) return false
  const typed = rows as RubricRow[]
  const expected = expectedTmLabels(tag)
  const labelsOk =
    rowsMatchExpectedLabels(typed, expected) ||
    (!isInfraTag(tag) && isLegacyTokenMechanicRubric(typed))
  if (!labelsOk) return false
  return rowsHaveValidTmShape(typed)
}

function normalizeLevel(level: unknown): Level | null {
  if (level === 'high' || level === 'mid' || level === 'low') return level
  if (level === 'medium') return 'mid'
  return null
}

function normalizeWeight(weight: unknown): string | null {
  if (typeof weight !== 'string') return null
  const w = weight.trim()
  if (TM_WEIGHTS.has(w)) return w
  if (/^\d+$/.test(w)) return `${w}%`
  return null
}

/** Accept any N% weight — used when coercing mis-tagged SL/legacy rows onto consumer TM. */
function normalizeWeightLoose(weight: unknown): string | null {
  if (typeof weight !== 'string') return null
  const w = weight.trim()
  if (/^\d+(\.\d+)?%$/.test(w)) return w
  if (/^\d+$/.test(w)) return `${w}%`
  return null
}

function sanitizeRubricRow(raw: unknown, looseWeight = false): RubricRow | null {
  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as RubricRow
  const level = normalizeLevel(row.level)
  const weight = looseWeight ? normalizeWeightLoose(row.weight) : normalizeWeight(row.weight)
  if (!level || !weight || typeof row.label !== 'string' || typeof row.source !== 'string') return null
  return { ...row, level, weight }
}

/**
 * Accept v3, legacy, or mis-tagged rows (e.g. shipping-leverage labels on a direct repo).
 * When labels/weights don't match, preserve levels/sources and assign consumer TM labels by weight order.
 */
export function coerceTokenMechanicRows(rows: unknown, tag: Tag): RubricRow[] | null {
  if (!Array.isArray(rows) || rows.length !== 3) return null
  const sanitized = rows.map(r => sanitizeRubricRow(r, true)).filter((r): r is RubricRow => r !== null)
  if (sanitized.length !== 3) return null

  const tmValid = validateTokenMechanicRows([...sanitized], tag)
  if (tmValid) {
    return normalizeTokenMechanicRows(sanitized, tag)
  }

  if (isInfraTag(tag)) return null

  // Preserve row order when weights are SL-style (40/35/25) — not TM order.
  const ordered = sanitized

  return TM_CONSUMER_LABELS.map((label, i) => ({
    label,
    weight: TM_WEIGHT_BY_LABEL[label] as RubricRow['weight'],
    level: ordered[i]!.level,
    source: ordered[i]!.source,
  }))
}

export function tmRubricLevelScore(
  repo: { tokenMechanic?: { rubric: RubricRow[] } | null },
  labels: string[],
): number {
  for (const label of labels) {
    const row = repo.tokenMechanic?.rubric.find(x => x.label === label)
    if (row) {
      return row.level === 'high' ? 100 : row.level === 'mid' ? 67 : 33
    }
  }
  return 33
}

export const TM_CONSUMER_PROMPT = `- tokenMechanic (consumer — direct and supply-lock tags ONLY):
  "Direct CLAWD economic impact" (50%): High = core function burns/locks/uses CLAWD as main economic unit; Mid = meaningful but secondary CLAWD use; Low = no visible CLAWD mechanic in core logic.
  "Mechanism clarity and holder relevance" (30%): High = holder can infer specific CLAWD effect from repo/Chronicle; Mid = partial/vague; Low = generic or absent CLAWD mention.
  "Alignment with CLAWD economic story" (20%): High = fits apps-that-burn-lock-pay narrative; Mid = compatible but not central; Low = ornamental or off-story.`

export const TM_INFRA_PROMPT = `- tokenMechanic (infrastructure/theoretical tags):
  "CLAWD mechanic enablement" (50%): High = clearly enables downstream CLAWD burns/locks/payments; Mid = generic infra that could help CLAWD apps; Low = no distinguishable CLAWD enablement.
  "Clarity of economic role in ecosystem" (30%): High = plain-language economic role is clear; Mid = partial; Low = opaque or absent.
  "Alignment with CLAWD economic story (infra)" (20%): High = supports CLAWD narrative without confusing CLAWD vs CV; Mid = neutral healthy infra; Low = could mislead on economic role.`

export const TM_EDGE_RULES = `Edge rules:
- Infra/indirect/theoretical repos use shippingLeverage instead of tokenMechanic — low direct burn is not a quality penalty.
- Dormant repos: still count live on-chain mechanics if Chronicle/README show they remain active.
- LarvAI/governance: CV/CONVICTION is governance, not CLAWD burn economics.
- Landing pages: Low TM is expected — representation is not economic routing.
- Vesting/lock repos: Mid at best on direct economic impact; locks are not burns.`
