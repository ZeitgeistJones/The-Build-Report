import { pctToLetter } from './gradeLetters'
import {
  CRITICAL_PATH_FLOOR_PCT,
  getEffectiveTag,
  shouldFloorAtC,
} from './criticalPath'
import { hasShippingLeverageTag, calcShippingLeveragePct } from './rubrics/shippingLeverage'
import { calcTokenMechanicPct } from './scores'
import type { Repo, Score } from './scores'

export { hasShippingLeverageTag, getEffectiveTag }

function scoreFromRows(rows: Score['rubric'], calc: (rows: Score['rubric']) => number): Score {
  const pct = calc(rows)
  return { letter: pctToLetter(pct), pct, rubric: rows }
}

function applyCriticalPathFloor(repo: Repo, score: Score): Score {
  if (!shouldFloorAtC(repo.githubSlug)) return score
  if (score.pct >= CRITICAL_PATH_FLOOR_PCT) return score
  return {
    ...score,
    pct: CRITICAL_PATH_FLOOR_PCT,
    letter: pctToLetter(CRITICAL_PATH_FLOOR_PCT),
  }
}

/** Infra/indirect/theoretical — economic axis is N/A; this is display-only, not blended into ecosystem TM. */
export function showsEconomicNa(repo: Repo): boolean {
  return hasShippingLeverageTag(getEffectiveTag(repo))
}

/** Resolved shipping-leverage grade (explicit field or legacy infra tokenMechanic rubric). */
export function getShippingLeverage(repo: Repo): Score | null {
  const tag = getEffectiveTag(repo)
  if (!hasShippingLeverageTag(tag)) return null

  let score: Score | null = null
  if (repo.shippingLeverage?.rubric.length) {
    score = scoreFromRows(repo.shippingLeverage.rubric, calcShippingLeveragePct)
  } else if (repo.tokenMechanic?.rubric.length) {
    score = scoreFromRows(repo.tokenMechanic.rubric, calcShippingLeveragePct)
  }
  if (!score) return null
  return applyCriticalPathFloor(repo, score)
}

/** Direct token mechanic — consumer and supply-lock repos only. */
export function getTokenMechanicForDisplay(repo: Repo): Score | null {
  if (showsEconomicNa(repo)) return null
  if (!repo.tokenMechanic?.rubric.length) return null
  const score = scoreFromRows(repo.tokenMechanic.rubric, calcTokenMechanicPct)
  return applyCriticalPathFloor(repo, score)
}

/** Consumer burn-app economic score — used for ecosystem token-mechanic grade (excludes infra). */
export function getConsumerEconomicScore(repo: Repo): Score | null {
  return getTokenMechanicForDisplay(repo)
}

export function getConsumerEconomicScorePct(repo: Repo): number | null {
  return getConsumerEconomicScore(repo)?.pct ?? null
}

export function isConsumerEconomicScored(repo: Repo): boolean {
  return getConsumerEconomicScorePct(repo) != null
}

/** @deprecated Use getConsumerEconomicScorePct for ecosystem blends; getShippingLeverage is display-only for infra. */
export function getEconomicScore(repo: Repo): Score | null {
  return getShippingLeverage(repo) ?? getTokenMechanicForDisplay(repo)
}

/** @deprecated Prefer getConsumerEconomicScorePct for ecosystem grades. */
export function getEconomicScorePct(repo: Repo): number | null {
  return getEconomicScore(repo)?.pct ?? null
}

/** @deprecated Prefer isConsumerEconomicScored for ecosystem TM grade sample. */
export function isEconomicScoreScored(repo: Repo): boolean {
  return isConsumerEconomicScored(repo)
}
