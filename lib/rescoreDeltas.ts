import { getShippingLeverage, getTokenMechanicForDisplay } from './economicGrade'
import type { Level, Repo, RubricRow } from './scores'
import { rubricRowPoints } from './rubricDisplay'

export type RubricRowSnapshot = {
  label: string
  level: Level
  weight: string
}

export type RescoreRubricsSnapshot = {
  shippingLeverage?: RubricRowSnapshot[]
  tokenMechanic?: RubricRowSnapshot[]
  builderIntegrity: RubricRowSnapshot[]
}

export type RubricRowDelta = {
  label: string
  deltaEarned: number
  oldLevel: Level | null
  newLevel: Level
  levelChangeLabel: string | null
}

export type RescoreAggregateDelta = {
  economic: { oldPct: number | null; newPct: number | null; deltaPct: number | null; label: string }
  builderIntegrity: { oldPct: number | null; newPct: number; deltaPct: number | null; label: string }
  rowDeltas: {
    shippingLeverage: RubricRowDelta[]
    tokenMechanic: RubricRowDelta[]
    builderIntegrity: RubricRowDelta[]
  }
}

function snapshotRows(rows: RubricRow[] | undefined): RubricRowSnapshot[] | undefined {
  if (!rows?.length) return undefined
  return rows.map(r => ({ label: r.label, level: r.level, weight: r.weight }))
}

export function snapshotRubricsFromRepo(repo: Repo | null | undefined): RescoreRubricsSnapshot | null {
  if (!repo) return null
  const sl = getShippingLeverage(repo)
  const tm = getTokenMechanicForDisplay(repo)
  return {
    shippingLeverage: snapshotRows(sl?.rubric),
    tokenMechanic: snapshotRows(tm?.rubric),
    builderIntegrity: snapshotRows(repo.builderIntegrity.rubric) ?? [],
  }
}

function levelLabel(level: Level): string {
  return level
}

export function diffRubricRow(
  oldRow: RubricRowSnapshot | undefined,
  newRow: RubricRow,
): RubricRowDelta {
  const { earned: newEarned } = rubricRowPoints(newRow.weight, newRow.level)
  const oldLevel = oldRow?.level ?? null
  const { earned: oldEarned } = oldRow
    ? rubricRowPoints(oldRow.weight, oldRow.level)
    : { earned: 0 }
  const deltaEarned = newEarned - oldEarned
  const levelChangeLabel =
    oldLevel && oldLevel !== newRow.level
      ? `${levelLabel(oldLevel)} → ${levelLabel(newRow.level)}`
      : null
  return {
    label: newRow.label,
    deltaEarned,
    oldLevel,
    newLevel: newRow.level,
    levelChangeLabel,
  }
}

export function diffRubricRows(
  oldRows: RubricRowSnapshot[] | undefined,
  newRows: RubricRow[],
): RubricRowDelta[] {
  const oldByLabel = new Map((oldRows ?? []).map(r => [r.label, r]))
  return newRows.map(row => diffRubricRow(oldByLabel.get(row.label), row))
}

function pctDeltaLabel(delta: number | null): string {
  if (delta == null) return 'new score'
  if (delta === 0) return 'flat'
  return delta > 0 ? `+${delta} pts` : `${delta} pts`
}

export function computeRescoreDeltas(oldRepo: Repo | null, newRepo: Repo): RescoreAggregateDelta {
  const oldSl = oldRepo ? getShippingLeverage(oldRepo) : null
  const newSl = getShippingLeverage(newRepo)
  const oldTm = oldRepo ? getTokenMechanicForDisplay(oldRepo) : null
  const newTm = getTokenMechanicForDisplay(newRepo)

  const oldEconomicPct = oldSl?.pct ?? oldTm?.pct ?? null
  const newEconomicPct = newSl?.pct ?? newTm?.pct ?? null
  const economicDelta =
    oldEconomicPct != null && newEconomicPct != null ? newEconomicPct - oldEconomicPct : null

  const oldBiPct = oldRepo?.builderIntegrity.pct ?? null
  const newBiPct = newRepo.builderIntegrity.pct
  const biDelta = oldBiPct != null ? newBiPct - oldBiPct : null

  const oldRubrics = snapshotRubricsFromRepo(oldRepo)

  return {
    economic: {
      oldPct: oldEconomicPct,
      newPct: newEconomicPct,
      deltaPct: economicDelta,
      label: pctDeltaLabel(economicDelta),
    },
    builderIntegrity: {
      oldPct: oldBiPct,
      newPct: newBiPct,
      deltaPct: biDelta,
      label: pctDeltaLabel(biDelta),
    },
    rowDeltas: {
      shippingLeverage: diffRubricRows(oldRubrics?.shippingLeverage, newSl?.rubric ?? []),
      tokenMechanic: diffRubricRows(oldRubrics?.tokenMechanic, newTm?.rubric ?? []),
      builderIntegrity: diffRubricRows(oldRubrics?.builderIntegrity, newRepo.builderIntegrity.rubric),
    },
  }
}

export function formatRescoreDeltaHeader(deltas: RescoreAggregateDelta): string {
  const parts: string[] = []

  if (deltas.economic.newPct != null) {
    const axis = deltas.rowDeltas.shippingLeverage.length ? 'Shipping leverage' : 'Token mechanic'
    if (deltas.economic.oldPct == null) {
      parts.push(`${axis}: first score (${deltas.economic.newPct}%)`)
    } else {
      parts.push(`${axis} ${deltas.economic.label} (${deltas.economic.oldPct}% → ${deltas.economic.newPct}%)`)
    }
  }

  if (deltas.builderIntegrity.oldPct == null) {
    parts.push(`Builder standards: first score (${deltas.builderIntegrity.newPct}%)`)
  } else {
    parts.push(
      `Builder standards ${deltas.builderIntegrity.label} (${deltas.builderIntegrity.oldPct}% → ${deltas.builderIntegrity.newPct}%)`,
    )
  }

  return parts.join('. ') + '.'
}

export function formatChangedRowsForPrompt(deltas: RescoreAggregateDelta): string {
  const sections: string[] = []

  const appendSection = (title: string, rows: RubricRowDelta[]) => {
    const changed = rows.filter(r => r.deltaEarned !== 0 || r.oldLevel == null)
    if (!changed.length) return
    const lines = changed.map(r => {
      const pts =
        r.oldLevel == null
          ? `new row (${r.newLevel})`
          : r.deltaEarned === 0
            ? `${r.oldLevel} unchanged`
            : `${r.oldLevel} → ${r.newLevel} (${r.deltaEarned > 0 ? '+' : ''}${r.deltaEarned} pts)`
      return `  - ${r.label}: ${pts}`
    })
    sections.push(`${title}:\n${lines.join('\n')}`)
  }

  appendSection('Shipping leverage rows', deltas.rowDeltas.shippingLeverage)
  appendSection('Token mechanic rows', deltas.rowDeltas.tokenMechanic)
  appendSection('Builder standards rows', deltas.rowDeltas.builderIntegrity)

  return sections.length ? sections.join('\n\n') : 'No rubric row level changes.'
}

export function rowDeltaByLabel(deltas: RubricRowDelta[]): Map<string, RubricRowDelta> {
  return new Map(deltas.map(d => [d.label, d]))
}
