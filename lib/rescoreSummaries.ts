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

/** Our earlier PE fallback that only restates score moves — not a real “what landed” summary. */
function looksLikeWeakScoreRestatement(text: string): boolean {
  const hasMoveOnly =
    /money-side score (went up|dipped|held steady)|builder-standards score (went up|dipped|held steady)|score didn't (really )?change/i.test(
      text,
    )
  const hasWorkEvidence =
    /\b(redeploy|deploy|audit|scaffold|ported|shipped|verified|commit|frontend|contract|fix|live on)\b/i.test(
      text,
    )
  return hasMoveOnly && !hasWorkEvidence
}

/** Pull commit titles out of an old jargon summary's "Recent commits…" tail. */
export function extractCommitMessagesFromSummary(text: string): string[] {
  if (!text?.trim()) return []
  const m = text.match(
    /Recent commits in this rescore window:\s*([\s\S]+?)(?:\.\s*$|$)/i,
  )
  const blob = m?.[1]?.trim()
  if (!blob) return []
  return blob
    .split(/\s*;\s*/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 3)
    .slice(0, 4)
}

/** Soften one commit title for holders (no raw 0x dumps / insider toolkit names). */
function plainifyCommitTitle(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return ''

  // Whole-title rewrites for common shapes first
  if (/^Redeploy\b/i.test(t)) {
    return 'a verified Base redeploy using Scaffold-ETH 2'
  }
  if (/\baudits?\b/i.test(t) && /\b(contract|frontend|QA)\b/i.test(t)) {
    return 'contract and frontend audits (with fixes)'
  }
  if (/^Port to\b|\bScaffold-ETH 2\b|\bSE-?2\b/i.test(t) && /\b(port|frontend|monorepo)\b/i.test(t)) {
    return 'a Scaffold-ETH 2 port with a live Base frontend'
  }

  t = t.replace(/0x[a-fA-F0-9]{6,}/g, '')
  t = t.replace(/\(Basescan verified\)/gi, 'verified on Base')
  t = t.replace(/\bSE-?2\b/gi, 'Scaffold-ETH 2')
  t = t.replace(/\bethskills\b/gi, '')
  t = t.replace(/\b7-domain evm-audit-skills\b/gi, 'security review')
  t = t.replace(/\bevm-audit-skills\b/gi, 'security review')
  t = t.replace(/\bcanonical flow\b/gi, '')
  t = t.replace(/\bmonorepo\b/gi, 'project setup')
  t = t.replace(/\s*[|:]\s*/g, ' — ')
  t = t.replace(/\(\s*\)/g, '')
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim()
  t = t.replace(/^[\s—,-]+|[\s—,-]+$/g, '').replace(/\s*—\s*$/g, '').trim()
  return t
}

/**
 * Turn commit titles into a short “what landed” clause.
 * Exported for the rescore-time PE fallback (same voice as live display).
 */
export function plainWorkFromCommitMessages(messages: string[]): string | null {
  const themes = messages
    .map(plainifyCommitTitle)
    .filter(Boolean)
    .slice(0, 3)
  if (!themes.length) return null
  if (themes.length === 1) return themes[0]
  if (themes.length === 2) return `${themes[0]}, and ${themes[1]}`
  return `${themes[0]}; ${themes[1]}; and ${themes[2]}`
}

export type NormieWhatChangedInput = {
  repoName?: string
  oldEconomicLabel?: string | null
  newEconomicLabel?: string | null
  oldBuilderLabel?: string | null
  newBuilderLabel?: string | null
  commitMessages?: string[]
  /** Optional: economic/BI deltas when labels aren't available (rescore-time). */
  economicDeltaPct?: number | null
  builderDeltaPct?: number | null
  bothFlat?: boolean
}

/**
 * Plain-English What changed blurb that leads with what landed, then a soft
 * score note — never a pure restatement of the ±pts header.
 */
export function buildNormieWhatChangedBlurb(input: NormieWhatChangedInput): string {
  const name = input.repoName?.trim() || 'This project'
  const work = plainWorkFromCommitMessages(input.commitMessages ?? [])

  const econMove =
    input.economicDeltaPct != null
      ? input.economicDeltaPct === 0
        ? null
        : input.economicDeltaPct > 0
          ? 'went up'
          : 'dipped'
      : moveWord(pctFromLabel(input.oldEconomicLabel), pctFromLabel(input.newEconomicLabel))
  const biMove =
    input.builderDeltaPct != null
      ? input.builderDeltaPct === 0
        ? null
        : input.builderDeltaPct > 0
          ? 'went up'
          : 'dipped'
      : moveWord(pctFromLabel(input.oldBuilderLabel), pctFromLabel(input.newBuilderLabel))

  const bothFlat =
    input.bothFlat === true ||
    ((!econMove && !biMove) &&
      pctFromLabel(input.oldEconomicLabel) != null &&
      pctFromLabel(input.newEconomicLabel) != null)

  const scoreBits: string[] = []
  if (econMove) scoreBits.push(`money-side reading ${econMove}`)
  if (biMove) scoreBits.push(`builder-standards ${biMove}`)
  const scoreClause = scoreBits.length
    ? `${scoreBits.join(' and ')} — open the rows below for the plain why.`
    : `the scorecard reading held steady — open the rows below for the plain why.`

  if (work) {
    if (bothFlat || (!econMove && !biMove)) {
      return `${name} landed ${work}. That work didn't move the overall scorecard reading much yet — open the rows below for the plain why.`
    }
    return `${name} landed ${work}. ${scoreClause.charAt(0).toUpperCase()}${scoreClause.slice(1)}`
  }

  if (bothFlat || (!econMove && !biMove)) {
    return `${name}'s score didn't really change on this recheck — the latest work didn't move how it reads on the scorecard yet.`
  }
  return `On this recheck, ${name}'s ${scoreBits.map(s => s.replace(' reading', ' score').replace('builder-standards', 'builder-standards score')).join(' and its ')}. Open the rows below to see the plain reason behind each score.`
}

/** Build a clean Plain English blurb from the record alone (no LLM, no rescore). */
export function legacyNormieFallback(meta: RescoreSummaryRecord, repoName?: string): string {
  const fromSummary = extractCommitMessagesFromSummary(meta.summary || '')
  const fromNormie = extractCommitMessagesFromSummary(meta.summaryNormie || '')
  const commitMessages = fromSummary.length ? fromSummary : fromNormie
  return buildNormieWhatChangedBlurb({
    repoName,
    oldEconomicLabel: meta.oldTokenMechanic,
    newEconomicLabel: meta.newTokenMechanic,
    oldBuilderLabel: meta.oldBuilderIntegrity,
    newBuilderLabel: meta.newBuilderIntegrity,
    commitMessages,
  })
}

function shouldRebuildPlainSummary(text: string): boolean {
  return looksLikeJargonFallback(text) || looksLikeWeakScoreRestatement(text)
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
    // Prefer stored PE — but rebuild jargon / weak score-only restatements when we can.
    if (normie && !shouldRebuildPlainSummary(normie)) return normie
    if (technical && !shouldRebuildPlainSummary(technical)) return technical
    return legacyNormieFallback(meta, repoName)
  }
  if (normie && !looksLikeJargonFallback(normie) && !looksLikeWeakScoreRestatement(normie)) {
    return technical
  }
  // Legacy / dual-jargon: hide prose in technical mode (delta header still shows).
  if (technical && !looksLikeJargonFallback(technical)) return technical
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
