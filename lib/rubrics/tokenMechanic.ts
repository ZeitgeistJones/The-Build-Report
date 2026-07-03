import type { RubricRow, Tag } from '@/lib/scores'

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
}

export function isInfraTag(tag: Tag): boolean {
  return tag === 'infrastructure' || tag === 'theoretical'
}

export function expectedTmLabels(tag: Tag): readonly string[] {
  return isInfraTag(tag) ? TM_INFRA_LABELS : TM_CONSUMER_LABELS
}

export function validateTokenMechanicRows(rows: unknown[], tag: Tag): rows is RubricRow[] {
  if (!Array.isArray(rows) || rows.length !== 3) return false
  const expected = expectedTmLabels(tag)
  const labels = rows.map(r => (r as RubricRow).label)
  if (!expected.every(l => labels.includes(l))) return false

  return rows.every(r => {
    if (typeof r !== 'object' || r === null) return false
    const row = r as RubricRow
    return (
      typeof row.label === 'string' &&
      typeof row.source === 'string' &&
      TM_WEIGHTS.has(row.weight) &&
      (row.level === 'high' || row.level === 'mid' || row.level === 'low') &&
      row.weight === TM_WEIGHT_BY_LABEL[row.label]
    )
  })
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

export const TM_CONSUMER_PROMPT = `- tokenMechanic (consumer — direct, supply-lock, indirect tags):
  "Direct CLAWD economic impact" (50%): High = core function burns/locks/uses CLAWD as main economic unit; Mid = meaningful but secondary CLAWD use; Low = no visible CLAWD mechanic in core logic.
  "Mechanism clarity and holder relevance" (30%): High = holder can infer specific CLAWD effect from repo/Chronicle; Mid = partial/vague; Low = generic or absent CLAWD mention.
  "Alignment with CLAWD economic story" (20%): High = fits apps-that-burn-lock-pay narrative; Mid = compatible but not central; Low = ornamental or off-story.`

export const TM_INFRA_PROMPT = `- tokenMechanic (infrastructure/theoretical tags):
  "CLAWD mechanic enablement" (50%): High = clearly enables downstream CLAWD burns/locks/payments; Mid = generic infra that could help CLAWD apps; Low = no distinguishable CLAWD enablement.
  "Clarity of economic role in ecosystem" (30%): High = plain-language economic role is clear; Mid = partial; Low = opaque or absent.
  "Alignment with CLAWD economic story (infra)" (20%): High = supports CLAWD narrative without confusing CLAWD vs CV; Mid = neutral healthy infra; Low = could mislead on economic role.`

export const TM_EDGE_RULES = `Edge rules:
- Infra repos may legitimately score Low on token mechanics — that is not low project quality.
- Dormant repos: still count live on-chain mechanics if Chronicle/README show they remain active.
- LarvAI/governance: CV/CONVICTION is governance, not CLAWD burn economics.
- Landing pages: Low TM is expected — representation is not economic routing.
- Vesting/lock repos: Mid at best on direct economic impact; locks are not burns.`
