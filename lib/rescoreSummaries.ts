import { Redis } from '@upstash/redis'
import { getRedis } from '@/lib/redis'
import { Repo, Score } from './scores'
import { getConsumerEconomicScore, getShippingLeverage } from './economicGrade'
import { type RescoreRubricsSnapshot, snapshotRubricsFromRepo } from './rescoreDeltas'
import { RESCORE_NOT_SCORED_LABEL } from './scoringCopy'

function formatEconomicLabel(repo: Repo | null | undefined): string | null {
  if (!repo) return null
  const sl = getShippingLeverage(repo)
  if (sl) return `${sl.letter} (${sl.pct}%) SL`
  const tm = getConsumerEconomicScore(repo)
  if (tm) return `${tm.letter} (${tm.pct}%)`
  return null
}

const KEY_PREFIX = 'build-report:rescore-summary:'

export type RescoreSummaryRecord = {
  summary: string
  /** Plain English “what changed”; when set, `summary` is the technical version. */
  summaryNormie?: string | null
  deltaHeader?: string | null
  oldTokenMechanic: string | null
  newTokenMechanic: string | null
  oldBuilderIntegrity: string
  newBuilderIntegrity: string
  oldScoredAt: string | null
  newScoredAt: string
  commits30dAtRescore: number
  rescoreAt: string
  oldRubrics?: RescoreRubricsSnapshot | null
}

function summaryKey(slug: string) {
  return `${KEY_PREFIX}${slug}`
}

export function formatScoreLabel(score: Score | null | undefined): string | null {
  if (!score) return null
  return `${score.letter} (${score.pct}%)`
}

export function buildRescoreSummaryRecord(params: {
  oldRepo: Repo | null
  newRepo: Repo
  summary: string | null
  summaryNormie?: string | null
  deltaHeader: string | null
  commits30dAtRescore: number
}): RescoreSummaryRecord {
  const { oldRepo, newRepo, summary, summaryNormie, deltaHeader, commits30dAtRescore } = params
  return {
    summary: summary?.trim() ?? '',
    summaryNormie: summaryNormie?.trim() || null,
    deltaHeader: deltaHeader?.trim() || null,
    oldTokenMechanic: formatEconomicLabel(oldRepo),
    newTokenMechanic: formatEconomicLabel(newRepo),
    oldBuilderIntegrity: formatScoreLabel(oldRepo?.builderIntegrity) ?? RESCORE_NOT_SCORED_LABEL,
    newBuilderIntegrity: formatScoreLabel(newRepo.builderIntegrity) ?? '—',
    oldScoredAt: oldRepo?.scoredAt ?? null,
    newScoredAt: newRepo.scoredAt,
    commits30dAtRescore,
    rescoreAt: new Date().toISOString(),
    oldRubrics: snapshotRubricsFromRepo(oldRepo),
  }
}

/** Pull the % out of a stored score label like "A (93%) SL" or "F+ (58%)". */
function pctFromLabel(label?: string | null): number | null {
  if (!label) return null
  const m = label.match(/\((\d+)%\)/)
  return m ? Number(m[1]) : null
}

/** Plain direction word from two score percentages. */
function moveWord(oldPct: number | null, newPct: number | null): 'went up' | 'dipped' | null {
  if (oldPct == null || newPct == null || oldPct === newPct) return null
  return newPct > oldPct ? 'went up' : 'dipped'
}

/**
 * Old records stored a single jargon-heavy fallback in `summary` (raw rubric row
 * names, "expand those rows / the move itself is not the reason", raw commit titles,
 * 0x addresses). Detect that shape so Plain English mode can swap in a clean version
 * without needing a rescore.
 */
function looksLikeJargonFallback(text: string): boolean {
  return (
    /the move itself is not the reason/i.test(text) ||
    /expand those rows/i.test(text) ||
    /recent commits in this rescore window/i.test(text) ||
    /0x[a-f0-9]{6,}/i.test(text) ||
    /\b(low|mid|high|n\/?a)\s*→\s*(low|mid|high|n\/?a)\b/i.test(text) ||
    /Security, testing, and cryptographic rigor|On-chain commitments and constraints|Downstream path to holder value|Multiplies builder shipping capacity|Role in ecosystem workflow|User funds, risk, and safety posture|Transparency and verifiability|Governance, token-economics/i.test(
      text,
    )
  )
}

/** Build a clean Plain English blurb from the record alone (no LLM, no rescore). */
export function legacyNormieFallback(meta: RescoreSummaryRecord, repoName?: string): string {
  const name = repoName?.trim() || 'This project'
  const econMove = moveWord(pctFromLabel(meta.oldTokenMechanic), pctFromLabel(meta.newTokenMechanic))
  const biMove = moveWord(pctFromLabel(meta.oldBuilderIntegrity), pctFromLabel(meta.newBuilderIntegrity))

  const parts: string[] = []
  if (econMove) parts.push(`its money-side score ${econMove}`)
  if (biMove) parts.push(`its builder-standards score ${biMove}`)

  if (!parts.length) {
    return `${name}'s score didn't really change on this recheck. Open the rows below to see how each part scored.`
  }
  return `On this recheck, ${name}'s ${parts.join(' and ')}. Open the rows below to see the plain reason behind each score.`
}

/** Pick technical vs Plain English “what changed” text for the toggle. */
export function rescoreSummaryForDisplay(
  meta: RescoreSummaryRecord,
  plain: boolean,
  repoName?: string,
): string {
  const technical = meta.summary?.trim() ?? ''
  const normie = meta.summaryNormie?.trim() ?? ''
  if (plain) {
    if (normie) return normie
    // Legacy PE-only records stored PE in `summary` — reuse it unless it's the old
    // jargon fallback, in which case build a clean version from the record.
    if (technical && !looksLikeJargonFallback(technical)) return technical
    return legacyNormieFallback(meta, repoName)
  }
  if (normie) return technical
  // Legacy: only one blurb on file — hide it in technical mode (delta header still shows).
  return ''
}

export async function saveRescoreSummary(
  slug: string,
  record: RescoreSummaryRecord,
  client?: Redis,
): Promise<void> {
  const r = client ?? getRedis()
  await r.set(summaryKey(slug), record, { ex: 60 * 60 * 24 * 90 })
}

export async function getRescoreSummary(slug: string): Promise<RescoreSummaryRecord | null> {
  try {
    const r = getRedis()
    const raw = await r.get<RescoreSummaryRecord>(summaryKey(slug))
    return raw ?? null
  } catch {
    return null
  }
}

export async function getRescoreSummaries(
  slugs: string[],
): Promise<Record<string, RescoreSummaryRecord>> {
  if (!slugs.length) return {}
  try {
    const r = getRedis()
    const keys = slugs.map(summaryKey)
    const values = await r.mget<(RescoreSummaryRecord | null)[]>(...keys)
    const out: Record<string, RescoreSummaryRecord> = {}
    slugs.forEach((slug, i) => {
      const v = values[i]
      if (v && typeof v === 'object' && v.rescoreAt) out[slug] = v
    })
    return out
  } catch {
    return {}
  }
}
