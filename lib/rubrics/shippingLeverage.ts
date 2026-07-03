import type { RubricRow, Tag } from '@/lib/scores'

export const SL_WEIGHTS = new Set(['40%', '35%', '25%'])

export const SL_LABELS = [
  'Multiplies builder shipping capacity',
  'Downstream path to holder value',
  'Role in ecosystem workflow',
] as const

/** Legacy infra TM rows — mapped when displaying old scores as shipping leverage. */
export const LEGACY_SL_TM_LABELS = [
  'CLAWD mechanic enablement',
  'Clarity of economic role in ecosystem',
  'Alignment with CLAWD economic story (infra)',
  'Enables consumer apps that burn CLAWD',
  'Downstream path to holder value',
  'Mechanic is operational',
] as const

export const SL_WEIGHT_BY_LABEL: Record<string, string> = {
  'Multiplies builder shipping capacity': '40%',
  'Downstream path to holder value': '35%',
  'Role in ecosystem workflow': '25%',
}

export function hasShippingLeverageTag(tag: Tag): boolean {
  return tag === 'indirect' || tag === 'infrastructure' || tag === 'theoretical'
}

export function validateShippingLeverageRows(rows: unknown[]): rows is RubricRow[] {
  if (!Array.isArray(rows) || rows.length !== 3) return false
  const labels = rows.map(r => (r as RubricRow).label)
  if (!SL_LABELS.every(l => labels.includes(l))) return false

  return rows.every(r => {
    if (typeof r !== 'object' || r === null) return false
    const row = r as RubricRow
    return (
      typeof row.label === 'string' &&
      typeof row.source === 'string' &&
      SL_WEIGHTS.has(row.weight) &&
      (row.level === 'high' || row.level === 'mid' || row.level === 'low') &&
      row.weight === SL_WEIGHT_BY_LABEL[row.label]
    )
  })
}

function parseWeight(w: string): number {
  const n = parseFloat(w)
  return Number.isFinite(n) ? n / 100 : 0
}

export function calcShippingLeveragePct(rows: RubricRow[]): number {
  const levelMap = { high: 3, mid: 2, low: 1 } as const
  let total = 0
  for (const row of rows) {
    total += parseWeight(row.weight) * levelMap[row.level]
  }
  return Math.round((total / 3) * 100)
}

export function slRubricLevelScore(
  repo: { shippingLeverage?: { rubric: RubricRow[] } | null; tokenMechanic?: { rubric: RubricRow[] } | null },
  labels: string[],
): number {
  const rubric = repo.shippingLeverage?.rubric ?? repo.tokenMechanic?.rubric
  if (!rubric) return 33
  for (const label of labels) {
    const row = rubric.find(x => x.label === label)
    if (row) {
      return row.level === 'high' ? 100 : row.level === 'mid' ? 67 : 33
    }
  }
  return 33
}

export const SL_PROMPT = `- shippingLeverage (indirect, infrastructure, theoretical tags ONLY — replaces tokenMechanic):
  Set tokenMechanic to null. Score indirect ecosystem value: how much this repo multiplies the builder's ability to ship consumer apps that benefit holders.
  "Multiplies builder shipping capacity" (40%): High = on the critical path for autonomous shipping (e.g. clawd-harness, clawd-containers, dead-simple-agent, ethskills, nerve-cord); Mid = useful dev tooling with credible downstream apps; Low = generic scaffold or no distinguishable multiplier.
  "Downstream path to holder value" (35%): High = clear causal line to consumer apps that burn/lock CLAWD; Mid = indirect but credible (faster shipping → more burn apps); Low = no credible holder path described.
  "Role in ecosystem workflow" (25%): High = actively used in builder workflow with recent pushes; Mid = maintained but secondary; Low = dormant R&D or unclear adoption.

  Low direct CLAWD burn in-repo is expected — do not penalize for absence of burns. Judge multiplier effect on the autonomous-builder thesis.`
