import { createHash } from 'crypto'
import { generateText, hasLlmApiKey } from '@/lib/llm'
import { getRedis } from '@/lib/redis'
import { getExcludedSlugs } from '@/lib/repoExclude'
import { stripMarkdown } from '@/lib/textCleanup'
import { NORMIE_TEMPERATURE, normieVoiceGuidance } from '@/lib/normieVoice'
import {
  fetchLatestUpgrade,
  fetchReadmeHead,
  fetchTrackableRepoPushes,
  type LatestUpgrade,
  type TrackableRepoPush,
} from '@/lib/github'

const SNAPSHOT_KEY = 'build-report:utility-index:snapshot'
const UPDATED_AT_KEY = 'build-report:utility-index:updatedAt'
const LOCK_KEY = 'build-report:utility-index:lock'
const LOCK_TTL_SEC = 90
const TIME_BUDGET_MS = 270_000
const DEFAULT_LLM_CAP = 15
const HARD_LLM_MAX = 30

export type UtilityConfidence = 'high' | 'low'
export type UpgradeSource = 'release' | 'tag' | 'push'

export type UtilityIndexRow = {
  slug: string
  description: string | null
  pushedAt: string
  archived: boolean
  isFork: boolean
  lastUpgradeAt: string
  lastUpgradeLabel: string
  lastUpgradeSource: UpgradeSource
  /** null = not LLM-enriched yet */
  clawdUtility: string | null
  cvUtility: string | null
  confidence: UtilityConfidence
  fingerprint: string
  indexedAt: string
  llmAt: string | null
}

export type UtilityIndexSnapshot = {
  rows: Record<string, UtilityIndexRow>
  listedCount: number
}

export type UtilityIndexRefreshResult = {
  ok: boolean
  listed: number
  enriched: number
  llmCalls: number
  skipped: number
  rateLimited: boolean
  lockHeld?: boolean
  updatedAt: string | null
  error?: string
}

function llmCap(): number {
  const raw = Number(process.env.UTILITY_INDEX_LLM_CAP)
  const n = Number.isFinite(raw) ? Math.floor(raw) : DEFAULT_LLM_CAP
  return Math.max(1, Math.min(n, HARD_LLM_MAX))
}

function simpleHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function utilityFingerprint(parts: {
  pushedAt: string
  description: string | null
  lastUpgradeLabel: string
  readmeHash: string
}): string {
  return simpleHash(
    [parts.pushedAt, parts.description ?? '', parts.lastUpgradeLabel, parts.readmeHash].join('|'),
  )
}

export async function loadUtilityIndex(): Promise<{
  snapshot: UtilityIndexSnapshot
  updatedAt: string | null
}> {
  try {
    const r = getRedis()
    const [raw, updatedAt] = await Promise.all([
      r.get<UtilityIndexSnapshot>(SNAPSHOT_KEY),
      r.get<string>(UPDATED_AT_KEY),
    ])
    return {
      snapshot: raw?.rows ? raw : { rows: {}, listedCount: 0 },
      updatedAt: updatedAt ?? null,
    }
  } catch {
    return { snapshot: { rows: {}, listedCount: 0 }, updatedAt: null }
  }
}

async function saveUtilityIndex(snapshot: UtilityIndexSnapshot): Promise<string> {
  const r = getRedis()
  const updatedAt = new Date().toISOString()
  const listedCount = Object.keys(snapshot.rows).length
  const payload: UtilityIndexSnapshot = { ...snapshot, listedCount }
  await Promise.all([r.set(SNAPSHOT_KEY, payload), r.set(UPDATED_AT_KEY, updatedAt)])
  return updatedAt
}

async function acquireLock(): Promise<boolean> {
  try {
    const r = getRedis()
    const ok = await r.set(LOCK_KEY, '1', { nx: true, ex: LOCK_TTL_SEC })
    return Boolean(ok)
  } catch {
    return false
  }
}

async function releaseLock(): Promise<void> {
  try {
    await getRedis().del(LOCK_KEY)
  } catch {
    // non-fatal
  }
}

function hasUtilityValue(v: string | null): boolean {
  return Boolean(v && v !== 'none' && v !== 'unknown')
}

function normalizeUtility(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = stripMarkdown(raw).trim()
  if (!t) return null
  const lower = t.toLowerCase()
  if (lower === 'none' || lower === 'n/a' || lower === 'na') return 'none'
  if (lower === 'unknown') return 'unknown'
  return t.slice(0, 220)
}

function rowFromList(
  slug: string,
  live: TrackableRepoPush,
  prev: UtilityIndexRow | undefined,
): UtilityIndexRow {
  return {
    slug,
    description: live.description,
    pushedAt: live.pushedAt,
    archived: live.archived,
    isFork: live.isFork,
    lastUpgradeAt: prev?.lastUpgradeAt ?? live.pushedAt,
    lastUpgradeLabel: prev?.lastUpgradeLabel ?? 'Last push',
    lastUpgradeSource: prev?.lastUpgradeSource ?? 'push',
    clawdUtility: prev?.clawdUtility ?? null,
    cvUtility: prev?.cvUtility ?? null,
    confidence: prev?.confidence ?? 'low',
    fingerprint: prev?.fingerprint ?? '',
    indexedAt: prev?.indexedAt ?? new Date().toISOString(),
    llmAt: prev?.llmAt ?? null,
  }
}

type EnrichCandidate = {
  slug: string
  live: TrackableRepoPush
  prev: UtilityIndexRow | undefined
  priority: number
}

function buildEnrichQueue(
  liveMap: Map<string, TrackableRepoPush>,
  rows: Record<string, UtilityIndexRow>,
): EnrichCandidate[] {
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const out: EnrichCandidate[] = []

  for (const [slug, live] of liveMap) {
    const prev = rows[slug]
    let priority = 50
    if (!prev || prev.clawdUtility == null) priority = 0
    else if (prev.pushedAt !== live.pushedAt) priority = 10
    else if (prev.confidence === 'low' && prev.llmAt) {
      const age = now - new Date(prev.llmAt).getTime()
      if (age > weekMs) priority = 20
      else continue
    } else if (prev.llmAt && prev.pushedAt === live.pushedAt) {
      continue // fresh enough
    } else if (!prev.llmAt) {
      priority = 5
    } else {
      continue
    }
    out.push({ slug, live, prev, priority })
  }

  out.sort((a, b) => a.priority - b.priority || b.live.pushedAt.localeCompare(a.live.pushedAt))
  return out
}

async function extractUtilities(params: {
  slug: string
  description: string | null
  readmeHead: string | null
  upgrade: LatestUpgrade
}): Promise<{ clawdUtility: string; cvUtility: string; confidence: UtilityConfidence } | null> {
  if (!hasLlmApiKey()) return null

  const prompt = `Extract holder-facing utility for one clawdbotatg GitHub repo.

Repo: ${params.slug}
Description: ${params.description || '(none)'}
Latest upgrade (do not invent dates; already resolved): ${params.upgrade.label} (${params.upgrade.source}) at ${params.upgrade.at}

README head:
"""
${params.readmeHead || '(missing)'}
"""

${normieVoiceGuidance('verdict')}

Return ONLY JSON:
{"clawdUtility":"one plain sentence OR none","cvUtility":"one plain sentence OR none"}

Rules:
- clawdUtility = how holding/using $CLAWD matters for this repo (burn, gate, payment, lock). Use "none" if it does not touch CLAWD for holders.
- cvUtility = how Conviction/CV (staking weight, governance) matters. Use "none" if not CV-related. CV burns are NOT CLAWD burns.
- Infra/tooling with no token mechanic → both "none" is correct.
- Never invent a release/upgrade date.
- Keep the repo slug meaning accurate; no vague stand-ins.`

  try {
    const { text } = await generateText({
      prompt,
      maxTokens: 300,
      temperature: NORMIE_TEMPERATURE,
      label: 'utility-index',
    })
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      clawdUtility?: unknown
      cvUtility?: unknown
    }
    const clawdUtility = normalizeUtility(parsed.clawdUtility) ?? 'unknown'
    const cvUtility = normalizeUtility(parsed.cvUtility) ?? 'unknown'
    const confidence: UtilityConfidence =
      !params.readmeHead || clawdUtility === 'unknown' || cvUtility === 'unknown' ? 'low' : 'high'
    return { clawdUtility, cvUtility, confidence }
  } catch (err) {
    console.warn('[utility-index] LLM extract failed', params.slug, err)
    return null
  }
}

/**
 * Refresh utility index: sync all trackable list metadata, enrich up to N changed/missing with
 * release/tag + optional Haiku. Safe under rate limits (merge, never wipe).
 */
export async function refreshUtilityIndex(): Promise<UtilityIndexRefreshResult> {
  const locked = await acquireLock()
  if (!locked) {
    const { updatedAt } = await loadUtilityIndex()
    return {
      ok: true,
      listed: 0,
      enriched: 0,
      llmCalls: 0,
      skipped: 0,
      rateLimited: false,
      lockHeld: true,
      updatedAt,
    }
  }

  const started = Date.now()
  let rateLimited = false
  let llmCalls = 0
  let enriched = 0
  let skipped = 0

  try {
    const { snapshot: prior } = await loadUtilityIndex()
    const excluded = await getExcludedSlugs()
    const liveMap = await fetchTrackableRepoPushes()

    for (const slug of [...liveMap.keys()]) {
      if (excluded[slug]) liveMap.delete(slug)
    }

    const rows: Record<string, UtilityIndexRow> = { ...prior.rows }

    // Drop rows no longer trackable
    for (const slug of Object.keys(rows)) {
      if (!liveMap.has(slug)) delete rows[slug]
    }

    // Sync list metadata for every trackable repo (no per-repo API)
    for (const [slug, live] of liveMap) {
      rows[slug] = rowFromList(slug, live, rows[slug])
    }

    const fullQueue = buildEnrichQueue(liveMap, rows)
    const queue = fullQueue.slice(0, llmCap())
    skipped = Math.max(0, fullQueue.length - queue.length)

    for (const item of queue) {
      if (Date.now() - started > TIME_BUDGET_MS) break
      try {
        const upgrade = await fetchLatestUpgrade(item.slug, item.live.pushedAt)
        let readmeHead: string | null = null
        const needsLlm =
          !item.prev?.llmAt ||
          item.prev.pushedAt !== item.live.pushedAt ||
          item.prev.clawdUtility == null

        if (needsLlm) {
          readmeHead = await fetchReadmeHead(item.slug)
        }

        const readmeHash = readmeHead ? simpleHash(readmeHead) : 'noreadme'
        const fingerprint = utilityFingerprint({
          pushedAt: item.live.pushedAt,
          description: item.live.description,
          lastUpgradeLabel: upgrade.label,
          readmeHash,
        })

        if (
          item.prev?.fingerprint === fingerprint &&
          item.prev.clawdUtility != null &&
          item.prev.cvUtility != null
        ) {
          rows[item.slug] = {
            ...rows[item.slug],
            ...upgradeFields(upgrade),
            fingerprint,
            indexedAt: new Date().toISOString(),
          }
          continue
        }

        let clawdUtility = item.prev?.clawdUtility ?? null
        let cvUtility = item.prev?.cvUtility ?? null
        let confidence: UtilityConfidence = item.prev?.confidence ?? 'low'
        let llmAt = item.prev?.llmAt ?? null

        if (needsLlm) {
          const extracted = await extractUtilities({
            slug: item.slug,
            description: item.live.description,
            readmeHead,
            upgrade,
          })
          llmCalls++
          if (extracted) {
            clawdUtility = extracted.clawdUtility
            cvUtility = extracted.cvUtility
            confidence = extracted.confidence
            llmAt = new Date().toISOString()
          } else {
            clawdUtility = clawdUtility ?? 'unknown'
            cvUtility = cvUtility ?? 'unknown'
            confidence = 'low'
          }
        }

        rows[item.slug] = {
          slug: item.slug,
          description: item.live.description,
          pushedAt: item.live.pushedAt,
          archived: item.live.archived,
          isFork: item.live.isFork,
          ...upgradeFields(upgrade),
          clawdUtility,
          cvUtility,
          confidence,
          fingerprint,
          indexedAt: new Date().toISOString(),
          llmAt,
        }
        enriched++
      } catch (err) {
        if (err instanceof Error && err.message === 'rate_limited') {
          rateLimited = true
          break
        }
        console.warn('[utility-index] enrich failed', item.slug, err)
      }
    }

    // Thin-write guard: never replace a fat snapshot with empty
    const nextCount = Object.keys(rows).length
    const priorCount = Object.keys(prior.rows).length
    if (nextCount === 0 && priorCount > 0) {
      return {
        ok: false,
        listed: liveMap.size,
        enriched,
        llmCalls,
        skipped,
        rateLimited,
        updatedAt: null,
        error: 'refused empty overwrite',
      }
    }

    const updatedAt = await saveUtilityIndex({ rows, listedCount: nextCount })
    return {
      ok: true,
      listed: liveMap.size,
      enriched,
      llmCalls,
      skipped,
      rateLimited,
      updatedAt,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'utility index refresh failed'
    if (message === 'rate_limited') {
      return {
        ok: false,
        listed: 0,
        enriched,
        llmCalls,
        skipped,
        rateLimited: true,
        updatedAt: null,
        error: message,
      }
    }
    return {
      ok: false,
      listed: 0,
      enriched,
      llmCalls,
      skipped,
      rateLimited,
      updatedAt: null,
      error: message,
    }
  } finally {
    await releaseLock()
  }
}

function upgradeFields(upgrade: LatestUpgrade): Pick<
  UtilityIndexRow,
  'lastUpgradeAt' | 'lastUpgradeLabel' | 'lastUpgradeSource'
> {
  return {
    lastUpgradeAt: upgrade.at,
    lastUpgradeLabel: upgrade.label,
    lastUpgradeSource: upgrade.source,
  }
}

export function utilityIndexStats(snapshot: UtilityIndexSnapshot): {
  total: number
  enriched: number
} {
  const rows = Object.values(snapshot.rows)
  return {
    total: rows.length,
    enriched: rows.filter(r => r.clawdUtility != null && r.cvUtility != null).length,
  }
}

export function rowHasClawdUtility(row: UtilityIndexRow): boolean {
  return hasUtilityValue(row.clawdUtility)
}

export function rowHasCvUtility(row: UtilityIndexRow): boolean {
  return hasUtilityValue(row.cvUtility)
}
