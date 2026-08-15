/**
 * Admin-only Yesterday's Build digests for secondary GitHub accounts
 * (gitlawb / $GITLAWB, 1clawAI / $1clawAI, …). Overview-only — no grade cards.
 */

import { getRedis } from '@/lib/redis'
import { generateTextGeminiFirst, hasLlmApiKey } from '@/lib/llm'
import { stripMarkdown } from '@/lib/textCleanup'
import { NORMIE_TEMPERATURE, normieVoiceGuidance } from '@/lib/normieVoice'
import {
  type BuildBriefData,
  yesterdayMountainDateKey,
} from '@/lib/buildBrief'
import {
  fetchExternalOwnerDayActivity,
  type ExternalDayActivity,
  type ExternalDaySnapshot,
} from '@/lib/externalOwnerGithub'

const DIGEST_TTL_SEC = 90 * 24 * 3600

/** Shown once above all secondary-account Yesterday's Builds in Admin. */
export const EXTERNAL_BRIEFS_SUPER_DISCLAIMER =
  'SUPER DISCLAIMER — UNOFFICIAL / ALL PROJECTS BELOW. The Build Report is an independent community project. These Yesterday’s Builds are NOT affiliated with, endorsed by, sponsored by, or connected to the listed GitHub accounts, orgs, tokens, teams, employers, or related companies (including Base, Coinbase, OpenAI, Google, and others where applicable). Each brief is an automated, interpretive skim of public GitHub activity only — sometimes a single tracked repo, sometimes a capped sample of an org. Coverage can be incomplete, sampled, outdated, or wrong. None of this is an official product update, roadmap, endorsement, or financial advice. Do not treat anything here as any project’s official position.'

export type ExternalBriefAccountId =
  | 'gitlawb'
  | '1clawAI'
  | 'agoreums'
  | 'gblinproject'
  | 'base'
  | 'openclaw'
  | 'eliza'
  | 'openai-agents-python'
  | 'mastra'
  | 'crewai'
  | 'openhands'
  | 'google-adk'
  | 'goose'
  | 'composio'

export type ExternalBriefAccount = {
  id: ExternalBriefAccountId
  /** GitHub login / org */
  owner: string
  /** Exact ticker for prompts + UI (include $). Null = shipping summary only, no token framing. */
  ticker: string | null
  /** Admin / newspaper headline */
  label: string
  /** Redis key segment — keep gitlawb as-is so existing cache stays valid */
  redisSlug: string
  /**
   * If set, only these repo names under `owner` are scanned (required for huge orgs
   * like openai/google). If omitted, scans up to 40 recently pushed public repos.
   */
  focusRepos?: string[]
  /** Optional per-account coverage note (e.g. Base sampling limits) */
  sampleNote?: string
}

function repoPath(account: ExternalBriefAccount): string {
  if (account.focusRepos?.length === 1) return `${account.owner}/${account.focusRepos[0]}`
  if (account.focusRepos?.length) return `${account.owner}/{${account.focusRepos.join(',')}}`
  return account.owner
}

export const EXTERNAL_BRIEF_ACCOUNTS: ExternalBriefAccount[] = [
  {
    id: 'gitlawb',
    owner: 'gitlawb',
    ticker: '$GITLAWB',
    label: 'Gitlawb',
    redisSlug: 'gitlawb',
  },
  {
    id: '1clawAI',
    owner: '1clawAI',
    ticker: '$1clawAI',
    label: '1clawAI',
    redisSlug: '1clawAI',
  },
  {
    id: 'agoreums',
    owner: 'agoreums',
    ticker: null,
    label: 'Agoreums',
    redisSlug: 'agoreums',
  },
  {
    id: 'gblinproject',
    owner: 'gblinproject',
    ticker: null,
    label: 'Gblinproject',
    redisSlug: 'gblinproject',
  },
  {
    id: 'base',
    owner: 'base',
    ticker: null,
    label: 'Base',
    redisSlug: 'base',
    sampleNote:
      'Coverage limit (Base only): this is NOT the full Base org. We only sample up to 40 recently pushed public repos (newest pushes first). Quiet or important repos that did not push recently are often missing. Treat this as a partial skim of public GitHub, never an official Base changelog.',
  },
  {
    id: 'openclaw',
    owner: 'openclaw',
    ticker: null,
    label: 'OpenClaw',
    redisSlug: 'openclaw',
    focusRepos: ['openclaw'],
  },
  {
    id: 'eliza',
    owner: 'elizaOS',
    ticker: null,
    label: 'ElizaOS',
    redisSlug: 'eliza',
    focusRepos: ['eliza'],
  },
  {
    id: 'openai-agents-python',
    owner: 'openai',
    ticker: null,
    label: 'OpenAI Agents SDK',
    redisSlug: 'openai-agents-python',
    focusRepos: ['openai-agents-python'],
    sampleNote: 'Single-repo feed only (openai/openai-agents-python) — not the full OpenAI org.',
  },
  {
    id: 'mastra',
    owner: 'mastra-ai',
    ticker: null,
    label: 'Mastra',
    redisSlug: 'mastra',
    focusRepos: ['mastra'],
  },
  {
    id: 'crewai',
    owner: 'crewAIInc',
    ticker: null,
    label: 'CrewAI',
    redisSlug: 'crewai',
    focusRepos: ['crewAI'],
  },
  {
    id: 'openhands',
    owner: 'All-Hands-AI',
    ticker: null,
    label: 'OpenHands',
    redisSlug: 'openhands',
    focusRepos: ['OpenHands'],
  },
  {
    id: 'google-adk',
    owner: 'google',
    ticker: null,
    label: 'Google ADK',
    redisSlug: 'google-adk',
    focusRepos: ['adk-python'],
    sampleNote: 'Single-repo feed only (google/adk-python) — not the full Google org.',
  },
  {
    id: 'goose',
    owner: 'aaif-goose',
    ticker: null,
    label: 'Goose',
    redisSlug: 'goose',
    focusRepos: ['goose'],
  },
  {
    id: 'composio',
    owner: 'ComposioHQ',
    ticker: null,
    label: 'Composio',
    redisSlug: 'composio',
    focusRepos: ['composio'],
  },
]

export function getExternalBriefAccount(id: string): ExternalBriefAccount | null {
  return EXTERNAL_BRIEF_ACCOUNTS.find(a => a.id === id) ?? null
}

export function externalBriefGithubUrl(account: ExternalBriefAccount): string {
  if (account.focusRepos?.length === 1) {
    return `https://github.com/${account.owner}/${account.focusRepos[0]}`
  }
  return `https://github.com/${account.owner}`
}

export function externalBriefGithubLabel(account: ExternalBriefAccount): string {
  return repoPath(account)
}

export type ExternalDigestCache = {
  general: string
  generalNormie?: string
  dateKey: string
  repoCount: number
  commitCount: number
  generatedAt: string
  owner: string
  ticker: string | null
}

function digestRedisKey(account: ExternalBriefAccount, dateKey: string): string {
  return `build-report:${account.redisSlug}-digest:${dateKey}`
}

function formatActivityForPrompt(
  owner: string,
  activity: ExternalDayActivity[],
  dayLabel: string,
): string {
  if (!activity.length) return `No commits on ${owner} repos on ${dayLabel}.`

  return activity
    .map(row => {
      const desc = row.description ? ` — ${row.description.slice(0, 120)}` : ''
      const msgs = row.commits.slice(0, 10).map(c => `  - ${c.message}`).join('\n')
      const extra = row.commits.length > 10 ? `\n  - …and ${row.commits.length - 10} more` : ''
      return `${row.slug}${desc}:\n${msgs}${extra}`
    })
    .join('\n\n')
}

function buildFallbackGeneral(
  account: ExternalBriefAccount,
  snapshot: ExternalDaySnapshot,
): string {
  if (!snapshot.activity.length) {
    const target = account.focusRepos?.length
      ? `github.com/${repoPath(account)}`
      : `github.com/${account.owner}`
    const tail = account.ticker
      ? ` Check back tomorrow for a fresher read on what shipped for ${account.ticker}.`
      : ' Check back tomorrow for a fresher read on what shipped.'
    return `Quiet day on ${target} — no commits landed on the scanned public repos for ${snapshot.dateKey}.${tail}`
  }
  const names = snapshot.activity
    .slice(0, 5)
    .map(a => `${a.slug} (${a.commits.length} commit${a.commits.length === 1 ? '' : 's'})`)
    .join(', ')
  const extra =
    snapshot.activity.length > 5 ? ` and ${snapshot.activity.length - 5} more repos` : ''
  const who = account.ticker
    ? `the ${account.ticker} builder account`
    : `github.com/${account.owner}`
  let text = `On ${snapshot.dateKey}, work landed on ${names}${extra} under github.com/${account.owner}. This is a shipping summary for ${who} — not a scored Build Report grade card.`
  if (account.id === 'base') {
    text +=
      ' Partial sample only: up to 40 recently pushed public repos — not the full Base org, and not an official Base update.'
  }
  return text
}

async function generateOverviewWithAi(
  account: ExternalBriefAccount,
  snapshot: ExternalDaySnapshot,
): Promise<{ general: string; generalNormie?: string } | null> {
  if (!hasLlmApiKey()) return null

  const activityBlock = formatActivityForPrompt(account.owner, snapshot.activity, snapshot.dateKey)
  const tickerBlock = account.ticker
    ? `Token ticker (when relevant): ${account.ticker} — always write it exactly as ${account.ticker}.
- Mention ${account.ticker} only when commits/descriptions clearly touch the token, holders, or related product; otherwise focus on what shipped.`
    : `No known token ticker for this account — do not invent one. Focus on what shipped.`

  const baseRules =
    account.id === 'base'
      ? `
BASE / COINBASE RULES (mandatory):
- This feed is UNOFFICIAL and NOT affiliated with Base or Coinbase.
- The commit list is a PARTIAL SAMPLE (at most ~40 recently pushed public repos). Say that clearly near the start (one short sentence). Do not imply full-org coverage or an official changelog.
- Never speak as Base/Coinbase. Never invent roadmap, token, partnership, or product claims beyond the commit list.
- Do not soften the sampling limit.`
      : ''

  const scopeLine = account.focusRepos?.length
    ? `Tracked repo(s) only: ${account.focusRepos.map(r => `${account.owner}/${r}`).join(', ')} — do not invent activity from other repos in this org.`
    : `Owner scan: up to ~40 recently pushed public repos under github.com/${account.owner}.`

  const prompt = `You write Yesterday's Build for The Build Report — a short shipping summary for a SECONDARY GitHub project (not clawdbotatg / CLAWD).

Project label: ${account.label}
Account: github.com/${account.owner}
${scopeLine}
${tickerBlock}
Edition date (Mountain / America/Denver calendar): ${snapshot.dateKey}
Repos with commits that day: ${snapshot.repoCount}
Commits that day: ${snapshot.commitCount}
${baseRules}

COMMITS:
${activityBlock}

Write JSON only:
{"general":"…","generalNormie":"…"}

Rules:
- general: 2–4 short paragraphs (or fewer if quiet). Technical but readable. Name real repos that shipped. Ground claims in the commit list — do not invent features, burns, locks, or tokenomics.
- generalNormie: same facts in plain English for non-builders. ${normieVoiceGuidance('digestGeneral')}
- Never invent CLAWD framing, burn grades, or holder-economics scorecards — this account has no scores on The Build Report.
- If quiet (no commits), say so plainly and stop.
- No markdown, no bullet lists, no JSON inside the strings.`

  try {
    const { text, provider } = await generateTextGeminiFirst({
      prompt,
      maxTokens: 2048,
      temperature: NORMIE_TEMPERATURE,
      label: `${account.id}-brief`,
    })
    if (!text) {
      console.error(`[${account.id}-brief] empty LLM response`, { provider })
      return null
    }
    const trimmed = text.trim()
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      general?: unknown
      generalNormie?: unknown
    }
    const general = typeof parsed.general === 'string' ? stripMarkdown(parsed.general.trim()) : ''
    if (!general) return null
    const generalNormie =
      typeof parsed.generalNormie === 'string' && parsed.generalNormie.trim()
        ? stripMarkdown(parsed.generalNormie.trim())
        : undefined
    return { general, ...(generalNormie ? { generalNormie } : {}) }
  } catch (err) {
    console.error(`[${account.id}-brief] AI generation failed:`, err)
    return null
  }
}

async function readCachedDigest(
  account: ExternalBriefAccount,
  dateKey: string,
): Promise<ExternalDigestCache | null> {
  try {
    const r = getRedis()
    const raw = await r.get<string>(digestRedisKey(account, dateKey))
    if (!raw) return null
    if (typeof raw === 'string') return JSON.parse(raw) as ExternalDigestCache
    return raw as ExternalDigestCache
  } catch {
    return null
  }
}

async function cacheDigest(
  account: ExternalBriefAccount,
  payload: ExternalDigestCache,
): Promise<void> {
  try {
    const r = getRedis()
    await r.set(digestRedisKey(account, payload.dateKey), JSON.stringify(payload), {
      ex: DIGEST_TTL_SEC,
    })
  } catch {
    // non-fatal
  }
}

function toBriefData(digest: ExternalDigestCache): BuildBriefData {
  return {
    text: digest.general,
    general: digest.general,
    ...(digest.generalNormie ? { generalNormie: digest.generalNormie } : {}),
    cards: null,
    dateKey: digest.dateKey,
    isToday: false,
    repoCount: digest.repoCount,
    commitCount: digest.commitCount,
    generatedAt: digest.generatedAt,
  }
}

export async function generateAndCacheExternalDigest(
  accountId: ExternalBriefAccountId,
  options?: { force?: boolean; dateKey?: string },
): Promise<ExternalDigestCache> {
  const account = getExternalBriefAccount(accountId)
  if (!account) throw new Error(`Unknown external brief account: ${accountId}`)

  const dateKey = options?.dateKey ?? yesterdayMountainDateKey()
  if (!options?.force) {
    const existing = await readCachedDigest(account, dateKey)
    if (existing?.general?.trim()) return existing
  }

  const snapshot = await fetchExternalOwnerDayActivity(account.owner, dateKey, {
    focusRepos: account.focusRepos,
  })
  if (snapshot.rateLimited && snapshot.activity.length === 0) {
    console.warn(`[${account.id}-brief] rate limited with no activity; writing quiet fallback`, {
      dateKey,
    })
  }

  const ai = await generateOverviewWithAi(account, snapshot)
  if (!ai) {
    console.warn(`[${account.id}-brief] using template fallback`, {
      dateKey,
      repoCount: snapshot.repoCount,
      commitCount: snapshot.commitCount,
    })
  }

  const payload: ExternalDigestCache = {
    general: ai?.general ?? buildFallbackGeneral(account, snapshot),
    ...(ai?.generalNormie ? { generalNormie: ai.generalNormie } : {}),
    dateKey,
    repoCount: snapshot.repoCount,
    commitCount: snapshot.commitCount,
    generatedAt: new Date().toISOString(),
    owner: account.owner,
    ticker: account.ticker,
  }

  await cacheDigest(account, payload)
  return payload
}

export async function getExternalBrief(
  accountId: ExternalBriefAccountId,
  dateKey = yesterdayMountainDateKey(),
): Promise<BuildBriefData | null> {
  const account = getExternalBriefAccount(accountId)
  if (!account) return null
  const digest = await readCachedDigest(account, dateKey)
  if (!digest?.general?.trim()) return null
  return toBriefData(digest)
}

/** Cached briefs for every secondary account (public page + Admin). */
export async function getAllExternalBriefs(
  dateKey = yesterdayMountainDateKey(),
): Promise<Partial<Record<ExternalBriefAccountId, BuildBriefData | null>>> {
  const entries = await Promise.all(
    EXTERNAL_BRIEF_ACCOUNTS.map(async account => {
      const brief = await getExternalBrief(account.id, dateKey)
      return [account.id, brief] as const
    }),
  )
  return Object.fromEntries(entries)
}

/** Cron/warm: generate each secondary account; failures stay isolated. */
export async function generateAllExternalDigests(options?: {
  force?: boolean
  dateKey?: string
}): Promise<
  Array<{
    id: ExternalBriefAccountId
    ok: boolean
    dateKey?: string
    repoCount?: number
    commitCount?: number
    error?: string
  }>
> {
  const results = []
  for (const account of EXTERNAL_BRIEF_ACCOUNTS) {
    try {
      const digest = await generateAndCacheExternalDigest(account.id, options)
      results.push({
        id: account.id,
        ok: true,
        dateKey: digest.dateKey,
        repoCount: digest.repoCount,
        commitCount: digest.commitCount,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'external brief failed'
      console.error(`[external-brief] ${account.id} generation failed`, err)
      results.push({ id: account.id, ok: false, error: message })
    }
  }
  return results
}
