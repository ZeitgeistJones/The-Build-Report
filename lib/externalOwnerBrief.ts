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

/** Matches vercel.json cron for /api/cron/daily-digest (`0 7 * * *`). */
export const EXTERNAL_BRIEFS_REFRESH_NOTE =
  'Refreshes daily at 7:00 UTC · overnight Mountain'

/** Max commits fed into each Yesterday's Builds writeup (newest first). */
export const EXTERNAL_BRIEF_MAX_COMMITS = 40

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
  /** Optional static note (e.g. single-repo feeds under a huge org) */
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
  /** Newspaper headline for this edition — 3–7 words, written by the model. */
  headline?: string
  /** Plain-English headline for normie mode. */
  headlineNormie?: string
  /** One-sentence deck under the headline. */
  deck?: string
  /** Plain-English deck for normie mode. */
  deckNormie?: string
  /**
   * Model's read of how big a day this was for THIS account, 1–5.
   * 1 = routine/quiet, 3 = normal shipping day, 5 = a real landing
   * (launch, migration, major feature). Feeds front-page placement.
   */
  significance?: number
  dateKey: string
  repoCount: number
  commitCount: number
  generatedAt: string
  owner: string
  ticker: string | null
}

/**
 * BuildBriefData plus the newspaper fields that only secondary-account
 * editions carry. All optional, so anything already typed BuildBriefData
 * still assigns cleanly.
 */
export type ExternalBriefData = BuildBriefData & {
  headline?: string
  headlineNormie?: string
  deck?: string
  deckNormie?: string
  significance?: number
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
      const msgs = row.commits.map(c => `  - ${c.message}`).join('\n')
      return `${row.slug}${desc}:\n${msgs}`
    })
    .join('\n\n')
}

/** Keep at most N commits for the writeup (repos already sorted by volume). */
function capActivityCommits(
  activity: ExternalDayActivity[],
  maxCommits = EXTERNAL_BRIEF_MAX_COMMITS,
): ExternalDayActivity[] {
  let remaining = maxCommits
  const out: ExternalDayActivity[] = []
  for (const row of activity) {
    if (remaining <= 0) break
    const commits = row.commits.slice(0, remaining)
    if (!commits.length) continue
    remaining -= commits.length
    out.push({ ...row, commits })
  }
  return out
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
  return `On ${snapshot.dateKey}, work landed on ${names}${extra} under github.com/${account.owner}. This is a shipping summary for ${who} — not a scored Build Report grade card.`
}

/** Used when the LLM is unavailable — never invents news. */
function buildFallbackHeadline(
  account: ExternalBriefAccount,
  snapshot: ExternalDaySnapshot,
): string {
  if (!snapshot.activity.length) return 'Presses Idle Overnight'
  if (snapshot.repoCount === 1) {
    const slug = snapshot.activity[0].slug.split('/').pop() || account.label
    return `Work Lands On ${slug}`
  }
  return `Commits Across ${snapshot.repoCount} Repos`
}

type AiOverview = {
  general: string
  generalNormie?: string
  headline?: string
  headlineNormie?: string
  deck?: string
  deckNormie?: string
  significance?: number
}

/** Headlines must stay short and punchy — anything long or list-y is dropped. */
function cleanHeadline(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = stripMarkdown(value.trim())
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/, '')
    .trim()
  if (!text) return undefined
  if (text.length > 60) return undefined
  if (text.split(' ').length > 9) return undefined
  return text
}

function cleanDeck(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = stripMarkdown(value.trim()).replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  if (text.length > 170) return text.slice(0, 167).trimEnd() + '…'
  return text
}

function cleanSignificance(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return undefined
  const rounded = Math.round(n)
  if (rounded < 1) return 1
  if (rounded > 5) return 5
  return rounded
}

async function generateOverviewWithAi(
  account: ExternalBriefAccount,
  snapshot: ExternalDaySnapshot,
): Promise<AiOverview | null> {
  if (!hasLlmApiKey()) return null

  const cappedActivity = capActivityCommits(snapshot.activity)
  const promptCommitCount = cappedActivity.reduce((n, a) => n + a.commits.length, 0)
  const activityBlock = formatActivityForPrompt(account.owner, cappedActivity, snapshot.dateKey)
  const tickerBlock = account.ticker
    ? `Token ticker (when relevant): ${account.ticker} — always write it exactly as ${account.ticker}.
- Mention ${account.ticker} only when commits/descriptions clearly touch the token, holders, or related product; otherwise focus on what shipped.`
    : `No known token ticker for this account — do not invent one. Focus on what shipped.`

  const baseRules =
    account.id === 'base'
      ? `
BASE / COINBASE RULES (mandatory):
- This feed is UNOFFICIAL and NOT affiliated with Base or Coinbase.
- Never speak as Base/Coinbase. Never invent roadmap, token, partnership, or product claims beyond the commit list.`
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
Commits that day (full count): ${snapshot.commitCount}
Commits in this sample (capped at ${EXTERNAL_BRIEF_MAX_COMMITS}): ${promptCommitCount}
${baseRules}

COMMITS:
${activityBlock}

Write JSON only:
{"headline":"…","headlineNormie":"…","deck":"…","deckNormie":"…","significance":3,"general":"…","generalNormie":"…"}

Rules:
- headline: a real newspaper headline for this edition — 3 to 7 words, active present tense, no ending period, no quotes, no colons, sentence-shaped not label-shaped. Say what actually happened, from the commit list only. Good: "Deposit Panel Picks Your Tokens". Bad: "Daily Update", "${account.label} Ships Code", "Various Improvements". If the day was quiet, write a quiet headline ("Presses Idle Overnight") rather than inventing news.
- headlineNormie: same headline in plain English for non-builders. Same length limit.
- deck: ONE sentence under the headline, max 140 characters, adding a second concrete detail the headline left out. No period-stacking, no lists.
- deckNormie: same deck in plain English.
- significance: integer 1-5 for how big this day was FOR THIS ACCOUNT specifically. 1 = nothing or pure chores (dependency bumps, lint, typo fixes, CI noise). 2 = light maintenance. 3 = a normal shipping day. 4 = a notable feature, refactor, or release landed. 5 = a genuine landing — launch, migration, major subsystem. Judge the substance of the commits, NOT how many there are. Forty dependency bumps is a 1. One real feature merge is a 4. Be strict: most days are 2 or 3, and 5 should be rare.
- general: 2–4 short paragraphs (or fewer if quiet). Technical but readable. Name real repos that shipped. Ground claims in the commit list — do not invent features, burns, locks, or tokenomics.
- generalNormie: same facts in plain English for non-builders. ${normieVoiceGuidance('digestGeneral')}
- Never invent CLAWD framing, burn grades, or holder-economics scorecards — this account has no scores on The Build Report.
- Do NOT open with coverage/sampling disclaimers, “partial sample,” or “not the full org” — the page shows a short note under a story only when that day had more than ${EXTERNAL_BRIEF_MAX_COMMITS} commits.
- Never speak as the project’s official voice (including Base/Coinbase/OpenAI/Google).
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
      headline?: unknown
      headlineNormie?: unknown
      deck?: unknown
      deckNormie?: unknown
      significance?: unknown
    }
    const general = typeof parsed.general === 'string' ? stripMarkdown(parsed.general.trim()) : ''
    if (!general) return null
    const generalNormie =
      typeof parsed.generalNormie === 'string' && parsed.generalNormie.trim()
        ? stripMarkdown(parsed.generalNormie.trim())
        : undefined
    const headline = cleanHeadline(parsed.headline)
    const headlineNormie = cleanHeadline(parsed.headlineNormie)
    const deck = cleanDeck(parsed.deck)
    const deckNormie = cleanDeck(parsed.deckNormie)
    const significance = cleanSignificance(parsed.significance)
    return {
      general,
      ...(generalNormie ? { generalNormie } : {}),
      ...(headline ? { headline } : {}),
      ...(headlineNormie ? { headlineNormie } : {}),
      ...(deck ? { deck } : {}),
      ...(deckNormie ? { deckNormie } : {}),
      ...(significance ? { significance } : {}),
    }
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

function toBriefData(digest: ExternalDigestCache): ExternalBriefData {
  return {
    text: digest.general,
    general: digest.general,
    ...(digest.generalNormie ? { generalNormie: digest.generalNormie } : {}),
    ...(digest.headline ? { headline: digest.headline } : {}),
    ...(digest.headlineNormie ? { headlineNormie: digest.headlineNormie } : {}),
    ...(digest.deck ? { deck: digest.deck } : {}),
    ...(digest.deckNormie ? { deckNormie: digest.deckNormie } : {}),
    ...(digest.significance ? { significance: digest.significance } : {}),
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
    headline: ai?.headline ?? buildFallbackHeadline(account, snapshot),
    ...(ai?.headlineNormie ? { headlineNormie: ai.headlineNormie } : {}),
    ...(ai?.deck ? { deck: ai.deck } : {}),
    ...(ai?.deckNormie ? { deckNormie: ai.deckNormie } : {}),
    significance: ai?.significance ?? (snapshot.commitCount > 0 ? 2 : 1),
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
): Promise<ExternalBriefData | null> {
  const account = getExternalBriefAccount(accountId)
  if (!account) return null
  const digest = await readCachedDigest(account, dateKey)
  if (!digest?.general?.trim()) return null
  return toBriefData(digest)
}

/** Cached briefs for every secondary account (public page + Admin). */
export async function getAllExternalBriefs(
  dateKey = yesterdayMountainDateKey(),
): Promise<Partial<Record<ExternalBriefAccountId, ExternalBriefData | null>>> {
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