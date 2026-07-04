import { Redis } from '@upstash/redis'
import Anthropic from '@anthropic-ai/sdk'
import { Repo, Tag, Status, RubricRow, Score, calcTokenMechanicPct, REPOS } from './scores'
import { normalizeAndApplyV3 } from './repoV3'
import { pctToLetter } from './gradeLetters'
import { shouldSkipRepo } from './repoFilters'
import { getExcludedSlugs } from './repoExclude'
import { getChronicleContext } from './chronicleContext'
import { DEFAULT_ECOSYSTEM_CONTEXT, getEcosystemContext } from './ecosystemContext'
import { getRedis } from './redis'
import { fetchRepoBySlug } from './github'
import {
  BI_PROMPT,
  calcBuilderIntegrityPct,
  validateBuilderIntegrityRows,
} from './rubrics/builderIntegrity'
import {
  TM_CONSUMER_PROMPT,
  TM_EDGE_RULES,
  normalizeTokenMechanicRows,
  validateTokenMechanicRows,
} from './rubrics/tokenMechanic'
import {
  SL_PROMPT,
  calcShippingLeveragePct,
  hasShippingLeverageTag,
  validateShippingLeverageRows,
} from './rubrics/shippingLeverage'
import { getLockedTag } from './criticalPath'
import { ECOSYSTEM_DECODER_RING } from './rubrics/decoderRing'
import { SCORING_CONTEXT_VERSION } from './scoringContext'

const CACHE_KEY_PREFIX = 'build-report:autoscore:v3:'
const CACHE_KEY_PREFIX_V2 = 'build-report:autoscore:v2:'
const CACHE_KEY_PREFIX_V1 = 'build-report:autoscore:'

function maxNewPerRun(): number {
  const raw = process.env.AUTOSCORE_MAX_PER_RUN
  const n = raw ? parseInt(raw, 10) : 15
  return Number.isFinite(n) && n > 0 ? Math.min(n, 30) : 15
}

function normalizeCachedRepo(raw: Record<string, unknown> | null): Repo | null {
  if (!raw || typeof raw.githubSlug !== 'string' || shouldSkipRepo(raw.githubSlug)) return null
  let repo: Repo
  if (raw.tokenMechanic !== undefined) {
    repo = raw as unknown as Repo
  } else if (raw.holderRelevance !== undefined) {
    const { holderRelevance, ...rest } = raw
    repo = { ...rest, tokenMechanic: holderRelevance } as unknown as Repo
  } else {
    repo = raw as unknown as Repo
  }
  return normalizeAndApplyV3(repo)
}

async function readCachedScore(r: Redis, repoName: string): Promise<Repo | null> {
  try {
    const v3 = await r.get<Record<string, unknown>>(`${CACHE_KEY_PREFIX}${repoName}`)
    const fromV3 = normalizeCachedRepo(v3)
    if (fromV3) return fromV3

    const v2 = await r.get<Record<string, unknown>>(`${CACHE_KEY_PREFIX_V2}${repoName}`)
    const fromV2 = normalizeCachedRepo(v2)
    if (fromV2) return fromV2

    const v1 = await r.get<Record<string, unknown>>(`${CACHE_KEY_PREFIX_V1}${repoName}`)
    return normalizeCachedRepo(v1)
  } catch {
    return null
  }
}

export interface RawRepo {
  name: string
  description: string | null
  pushedAt: string
  createdAt: string
  language: string | null
  archived?: boolean
}

function deriveStatus(repo: RawRepo): Status {
  if (repo.archived) return 'archived'
  const days = (Date.now() - new Date(repo.pushedAt).getTime()) / 86_400_000
  if (days > 180) return 'archived'
  if (days > 60) return 'dormant'
  return 'active'
}

function makeTmScore(rows: RubricRow[]): Score {
  const pct = calcTokenMechanicPct(rows)
  return { letter: pctToLetter(pct), pct, rubric: rows }
}

function makeBiScore(rows: RubricRow[]): Score {
  const pct = calcBuilderIntegrityPct(rows)
  return { letter: pctToLetter(pct), pct, rubric: rows }
}

function makeSlScore(rows: RubricRow[]): Score {
  const pct = calcShippingLeveragePct(rows)
  return { letter: pctToLetter(pct), pct, rubric: rows }
}

const VALID_TAGS = new Set(['direct', 'supply-lock', 'indirect', 'infrastructure', 'theoretical'])

export function toRawRepo(gh: {
  name: string
  description: string | null
  pushedAt: string
  createdAt: string
  language: string | null
  archived?: boolean
}): RawRepo {
  return {
    name: gh.name,
    description: gh.description,
    pushedAt: gh.pushedAt,
    createdAt: gh.createdAt,
    language: gh.language,
    archived: gh.archived,
  }
}

async function inferScore(repo: RawRepo, options?: { chronicleContext?: string }): Promise<Repo | null> {
  console.log(`[autoscore] inferring: ${repo.name}`)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const derivedStatus = deriveStatus(repo)
  const ecosystemCtx =
    (await getEcosystemContext().catch(() => null)) ?? DEFAULT_ECOSYSTEM_CONTEXT

  const chronicleBlock = options?.chronicleContext?.trim()
    ? `Chronicle context (condensed):\n${options.chronicleContext.trim()}\n\n`
    : ''

  const prompt = `You are scoring a GitHub repository for the clawdbotatg CLAWD ecosystem (scoring v3).

${chronicleBlock}${ecosystemCtx}

Repo to score:
Name: ${repo.name}
Description: ${repo.description ?? 'none'}
Language: ${repo.language ?? 'unknown'}
Created: ${repo.createdAt}
Last pushed: ${repo.pushedAt}
Status (computed from push date): ${derivedStatus}

Infer:
1. tag: one of direct | supply-lock | indirect | infrastructure | theoretical
2. Economic axis (pick ONE based on tag):
   - direct or supply-lock → tokenMechanic rubric (consumer labels), shippingLeverage: null
   - indirect, infrastructure, or theoretical → shippingLeverage rubric, tokenMechanic: null
3. builderIntegrity rubric (5 rows — ALWAYS include all five; apply tag-specific BI rules below)
4. verdict: 2-3 sentence plain English — honest, not hype; quick-glance friendly
5. adminNote: one sentence — live AI score, not a launch baseline

Framing: score by repo type, not one universal standard. Infra/indirect score shipping leverage, not direct burn. Low GitHub activity is not automatic failure. CV/CONVICTION ≠ CLAWD burns. Locks/vesting ≠ burns. Hold clawdbotatg accountable on consumer apps and money-moving repos; do not penalize dev tools for missing burns.

${ECOSYSTEM_DECODER_RING}

${TM_CONSUMER_PROMPT}
${SL_PROMPT}
${TM_EDGE_RULES}

${BI_PROMPT}

Respond ONLY with valid JSON, no markdown:
{
  "tag": "infrastructure",
  "tokenMechanic": null,
  "shippingLeverage": [
    { "label": "Multiplies builder shipping capacity", "weight": "40%", "level": "mid", "source": "..." },
    { "label": "Downstream path to holder value", "weight": "35%", "level": "mid", "source": "..." },
    { "label": "Role in ecosystem workflow", "weight": "25%", "level": "mid", "source": "..." }
  ],
  "builderIntegrity": [
    { "label": "On-chain commitments and constraints", "weight": "22%", "level": "mid", "source": "..." },
    { "label": "User funds, risk, and safety posture", "weight": "20%", "level": "mid", "source": "..." },
    { "label": "Transparency and verifiability", "weight": "18%", "level": "mid", "source": "..." },
    { "label": "Governance, token-economics, and ecosystem alignment", "weight": "20%", "level": "mid", "source": "..." },
    { "label": "Security, testing, and cryptographic rigor", "weight": "20%", "level": "mid", "source": "..." }
  ],
  "verdict": "...",
  "adminNote": "Live AI score (v3) — inferred from repo metadata and ecosystem context v${SCORING_CONTEXT_VERSION}."
}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1536,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (!VALID_TAGS.has(parsed.tag)) {
      console.error(`[autoscore] invalid tag for ${repo.name}:`, parsed.tag)
      return null
    }

    const tag = (getLockedTag(repo.name) ?? parsed.tag) as Tag
    let tokenMechanic: Score | null = null
    let shippingLeverage: Score | null = null

    if (hasShippingLeverageTag(tag)) {
      if (validateShippingLeverageRows(parsed.shippingLeverage)) {
        shippingLeverage = makeSlScore(parsed.shippingLeverage)
      } else {
        const legacyRows: RubricRow[] = parsed.tokenMechanic ?? parsed.holderRelevance
        if (legacyRows?.length && validateTokenMechanicRows(legacyRows, tag)) {
          shippingLeverage = makeSlScore(legacyRows)
        } else {
          console.error(`[autoscore] invalid shippingLeverage rubric for ${repo.name}`)
          return null
        }
      }
    } else {
      const tokenMechanicRows: RubricRow[] = parsed.tokenMechanic ?? parsed.holderRelevance
      if (!validateTokenMechanicRows(tokenMechanicRows, tag)) {
        console.error(`[autoscore] invalid tokenMechanic rubric for ${repo.name}`)
        return null
      }
      const normalizedTm = normalizeTokenMechanicRows(tokenMechanicRows, tag)
      tokenMechanic = normalizedTm.length ? makeTmScore(normalizedTm) : null
    }

    if (!validateBuilderIntegrityRows(parsed.builderIntegrity)) {
      console.error(`[autoscore] invalid builderIntegrity rubric for ${repo.name}`)
      return null
    }

    const repoOut: Repo = {
      id: repo.name,
      name: repo.name,
      githubSlug: repo.name,
      tag,
      status: derivedStatus,
      confidence: 'low',
      scoredAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      tokenMechanic,
      shippingLeverage,
      builderIntegrity: makeBiScore(parsed.builderIntegrity),
      verdict: parsed.verdict,
      adminNote: parsed.adminNote,
      scoringContextVersion: SCORING_CONTEXT_VERSION,
    }

    const economic = shippingLeverage ?? tokenMechanic
    console.log(
      `[autoscore] done: ${repo.name} tag:${repoOut.tag} Econ:${economic?.letter ?? 'N/A'} BI:${repoOut.builderIntegrity.letter}`,
    )
    return normalizeAndApplyV3(repoOut)
  } catch (err) {
    console.error(`[autoscore] FAILED for ${repo.name}:`, err)
    return null
  }
}

async function cacheScoredRepo(repo: Repo): Promise<void> {
  try {
    const r = getRedis()
    await r.set(`${CACHE_KEY_PREFIX}${repo.githubSlug}`, repo, {
      ex: 60 * 60 * 24 * 7,
    })
  } catch {
    // non-fatal
  }
}

/** Infer (optional cache bypass) and write to Redis. Used by bulk regen and singles. */
export async function inferAndCacheRepo(
  raw: RawRepo,
  options?: { chronicleContext?: string; skipCache?: boolean },
): Promise<Repo | null> {
  const r = getRedis()

  if (!options?.skipCache) {
    const cached = await readCachedScore(r, raw.name)
    if (cached) return cached
  }

  const chronicleContext =
    options?.chronicleContext ?? (await getChronicleContext().catch(() => null)) ?? undefined

  const scored = await inferScore(raw, { chronicleContext })
  if (!scored) return null

  await cacheScoredRepo(scored)
  return scored
}

// HOMEPAGE-SAFE: cache only, no Anthropic calls
export async function getCachedAutoScoresForSlugs(slugs: string[]): Promise<Repo[]> {
  if (!slugs.length) return []

  const r = getRedis()
  const results: Repo[] = []

  await Promise.all(
    slugs.map(async slug => {
      const cached = await readCachedScore(r, slug)
      if (cached) results.push(cached)
    }),
  )

  return results
}

/** @deprecated Prefer getCachedAutoScoresForSlugs when slugs are already known. */
export async function getAutoScores(newRepos: RawRepo[]): Promise<Repo[]> {
  if (!newRepos.length) {
    console.log('[autoscore] no new repos to read from cache')
    return []
  }

  return getCachedAutoScoresForSlugs(newRepos.map(r => r.name))
}

function rankForInference(name: string, githubOrder: string[]): number {
  const idx = githubOrder.indexOf(name)
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}

export interface AutoScoreRunResult {
  repos: Repo[]
  inferred: string[]
  deferred: number
}

// CALL THIS FROM AN API ROUTE OR ADMIN ACTION, NOT app/page.tsx
export async function runAutoScores(
  newRepos: RawRepo[],
  options?: { githubOrder?: string[]; chronicleContext?: string },
): Promise<AutoScoreRunResult> {
  if (!newRepos.length) {
    console.log('[autoscore] no new repos to score')
    return { repos: [], inferred: [], deferred: 0 }
  }

  const maxPerRun = maxNewPerRun()
  const githubOrder = options?.githubOrder ?? []

  console.log(`[autoscore] ${newRepos.length} unscored repos found`)

  const excludedMap = await getExcludedSlugs()
  const excludedSlugs = new Set(Object.keys(excludedMap).filter(k => excludedMap[k]))

  const r = getRedis()
  const results: Repo[] = []
  const toInfer: RawRepo[] = []

  await Promise.all(
    newRepos.map(async (repo) => {
      const cached = await readCachedScore(r, repo.name)
      if (cached) {
        console.log(`[autoscore] cache hit: ${repo.name}`)
        results.push(cached)
      } else {
        toInfer.push(repo)
      }
    }),
  )

  console.log(`[autoscore] ${results.length} from cache, ${toInfer.length} need inference`)

  toInfer.sort((a, b) => {
    const aRank = rankForInference(a.name, githubOrder)
    const bRank = rankForInference(b.name, githubOrder)
    if (aRank !== bRank) return aRank - bRank
    return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
  })

  const batch = toInfer.slice(0, maxPerRun)
  if (toInfer.length > maxPerRun) {
    console.log(
      `[autoscore] capping at ${maxPerRun} this run, ${toInfer.length - maxPerRun} deferred`,
    )
  }

  const inferred: string[] = []

  const chronicleContext =
    options?.chronicleContext ?? (await getChronicleContext().catch(() => null)) ?? undefined

  for (const repo of batch) {
    if (excludedSlugs.has(repo.name)) continue
    const scored = await inferScore(repo, { chronicleContext })
    if (scored) {
      await cacheScoredRepo(scored)
      results.push(scored)
      inferred.push(repo.name)
    }
  }

  console.log(`[autoscore] run returning ${results.length} total (${inferred.length} newly inferred)`)
  return { repos: results, inferred, deferred: toInfer.length - inferred.length }
}

export async function resolveRepoBeforeRescore(repoSlug: string): Promise<Repo | null> {
  if (shouldSkipRepo(repoSlug)) return null

  const r = getRedis()
  const cached = await readCachedScore(r, repoSlug)
  if (cached) return cached

  const handScored = REPOS.find(repo => repo.githubSlug === repoSlug)
  return handScored ? normalizeAndApplyV3(handScored) : null
}

export async function runAutoscoreSingle(repoSlug: string): Promise<Repo | null> {
  if (shouldSkipRepo(repoSlug)) return null

  const gh = await fetchRepoBySlug(repoSlug)
  if (!gh) return null

  const raw: RawRepo = {
    name: gh.name,
    description: gh.description,
    pushedAt: gh.pushedAt,
    createdAt: gh.createdAt,
    language: gh.language,
    archived: gh.archived,
  }

  const chronicleContext = await getChronicleContext().catch(() => null)

  await flushAutoScore(repoSlug)
  return inferAndCacheRepo(raw, {
    chronicleContext: chronicleContext ?? undefined,
    skipCache: true,
  })
}

export async function flushAutoScore(repoName: string): Promise<void> {
  const r = getRedis()
  await r.del(`${CACHE_KEY_PREFIX}${repoName}`)
  await r.del(`${CACHE_KEY_PREFIX_V2}${repoName}`)
  await r.del(`${CACHE_KEY_PREFIX_V1}${repoName}`)
}

export async function listCachedAutoScores(): Promise<string[]> {
  const r = getRedis()
  try {
    const keysV3 = await r.keys(`${CACHE_KEY_PREFIX}*`)
    const keysV2 = await r.keys(`${CACHE_KEY_PREFIX_V2}*`)
    const keysV1 = await r.keys(`${CACHE_KEY_PREFIX_V1}*`)
    const names = new Set<string>()
    for (const k of keysV3) names.add(k.replace(CACHE_KEY_PREFIX, ''))
    for (const k of keysV2) names.add(k.replace(CACHE_KEY_PREFIX_V2, ''))
    for (const k of keysV1) {
      const name = k.replace(CACHE_KEY_PREFIX_V1, '')
      if (name && !name.startsWith('v2:') && !name.startsWith('v3:')) names.add(name)
    }
    return Array.from(names)
  } catch {
    return []
  }
}
