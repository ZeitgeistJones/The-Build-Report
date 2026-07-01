import { Redis } from '@upstash/redis'
import Anthropic from '@anthropic-ai/sdk'
import { Repo, Tag, Status, Level, RubricRow, Score } from './scores'
import { shouldSkipRepo } from './repoFilters'

let redis: Redis | null = null
function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
}

const CACHE_KEY_PREFIX = 'build-report:autoscore:v2:'
const CACHE_KEY_PREFIX_V1 = 'build-report:autoscore:'
const MAX_NEW_PER_RUN = 5

async function readCachedScore(r: Redis, repoName: string): Promise<Repo | null> {
  try {
    const v2 = await r.get<Repo>(`${CACHE_KEY_PREFIX}${repoName}`)
    if (v2 && !shouldSkipRepo(v2.githubSlug)) return v2

    const v1 = await r.get<Repo>(`${CACHE_KEY_PREFIX_V1}${repoName}`)
    if (v1 && !shouldSkipRepo(v1.githubSlug)) return v1

    return null
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
}

function calcScore(rows: RubricRow[]): number {
  const weightMap: Record<string, number> = {
    '50%': 0.5, '30%': 0.3, '20%': 0.2,
    '40%': 0.4, '35%': 0.35, '25%': 0.25,
  }
  const levelMap: Record<Level, number> = { high: 3, mid: 2, low: 1 }
  let total = 0
  for (const row of rows) {
    total += (weightMap[row.weight] ?? 0.33) * levelMap[row.level]
  }
  return Math.round((total / 3) * 100)
}

function letter(pct: number): string {
  if (pct >= 80) return 'A'
  if (pct >= 60) return 'B'
  if (pct >= 40) return 'C'
  return 'D'
}

function makeScore(rows: RubricRow[]): Score {
  const pct = calcScore(rows)
  return { letter: letter(pct), pct, rubric: rows }
}

const ECOSYSTEM_CONTEXT = `
clawdbotatg is an autonomous AI builder agent on Base blockchain. It builds tools for $CLAWD token holders.
Key facts:
- leftclaw-services: AI job marketplace — users pay USDC, buys and burns CLAWD automatically
- clawd-incinerator: direct burn contract, 10M CLAWD per call
- clawd-fomo3d-v2: onchain game, 20% of every pot burned
- clawdviction / larv.ai: governance staking, locks 8% of CLAWD supply
- dead-simple-agent: agent framework powering the Leftclaw worker fleet
- clawd-containers: Docker infrastructure running the worker bots
- zkllmapi-v2: ZK-proof private AI API, accepts CLAWD as payment
- ethskills: onchain knowledge graph for agents
- yet-another-builder-agent: meta-agent that builds other agents

Tag definitions:
- direct: burn mechanic on every interaction (burns CLAWD permanently)
- supply-lock: removes CLAWD from circulation temporarily (staking/vesting)
- indirect: enables other repos that burn CLAWD (infrastructure with clear burn downstream)
- infrastructure: no token mechanic expected, foundational tooling
- theoretical: R&D, no live mechanic yet

The project's stated goals: every consumer app burns CLAWD, autonomous operation, walkaway test (runs without clawdbotatg intervention).
`.trim()

async function inferScore(repo: RawRepo): Promise<Repo | null> {
  console.log(`[autoscore] inferring: ${repo.name}`)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are scoring a GitHub repository for the clawdbotatg CLAWD ecosystem.

${ECOSYSTEM_CONTEXT}

Repo to score:
Name: ${repo.name}
Description: ${repo.description ?? 'none'}
Language: ${repo.language ?? 'unknown'}
Created: ${repo.createdAt}
Last pushed: ${repo.pushedAt}

Based on the repo name, description, and ecosystem context, infer:
1. tag: one of direct | supply-lock | indirect | infrastructure | theoretical
2. status: one of active | dormant | archived
3. holderRelevance rubric (3 rows — ALWAYS include, use adapted criteria for infrastructure/theoretical)
4. builderIntegrity rubric (3 rows)
5. verdict: 2-3 sentence plain English assessment
6. adminNote: one sentence flagging this is auto-inferred, not hand-scored

For rubric rows use these exact weights:
- holderRelevance consumer apps: "Burn mechanic exists and is live" (50%), "Revenue or burn path built in" (30%), "Takes CLAWD out of circulation" (20%)
- holderRelevance infrastructure/theoretical (adapted): "Enables consumer apps that burn CLAWD" (50%), "Downstream path to holder value" (30%), "Active and maintained" (20%)
- builderIntegrity: "Serves stated vision at time of build" (40%), "Genuine autonomous build" (35%), "Passes walkaway test" (25%)
- level: "high" | "mid" | "low"
- source: brief inference note like "inferred from repo name" or "inferred from ecosystem context"

Respond ONLY with a valid JSON object in this exact shape, no markdown:
{
  "tag": "infrastructure",
  "status": "active",
  "holderRelevance": [
    { "label": "...", "weight": "50%", "level": "low", "source": "..." },
    { "label": "...", "weight": "30%", "level": "low", "source": "..." },
    { "label": "...", "weight": "20%", "level": "mid", "source": "..." }
  ],
  "builderIntegrity": [
    { "label": "...", "weight": "40%", "level": "high", "source": "..." },
    { "label": "...", "weight": "35%", "level": "high", "source": "..." },
    { "label": "...", "weight": "25%", "level": "mid", "source": "..." }
  ],
  "verdict": "...",
  "adminNote": "Scores auto-inferred from repo name and ecosystem context. Not hand-scored — treat as a starting point."
}`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    const holderRows: RubricRow[] = parsed.holderRelevance

    const repoOut: Repo = {
      id: repo.name,
      name: repo.name,
      githubSlug: repo.name,
      tag: parsed.tag as Tag,
      status: parsed.status as Status,
      confidence: 'low',
      scoredAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      holderRelevance: holderRows?.length ? makeScore(holderRows) : null,
      builderIntegrity: makeScore(parsed.builderIntegrity),
      verdict: parsed.verdict,
      adminNote: parsed.adminNote,
    }

    console.log(
      `[autoscore] done: ${repo.name} tag:${repoOut.tag} HR:${repoOut.holderRelevance?.letter ?? 'N/A'} BI:${repoOut.builderIntegrity.letter}`
    )
    return repoOut
  } catch (err) {
    console.error(`[autoscore] FAILED for ${repo.name}:`, err)
    return null
  }
}

// HOMEPAGE-SAFE: cache only, no Anthropic calls
export async function getAutoScores(newRepos: RawRepo[]): Promise<Repo[]> {
  if (!newRepos.length) {
    console.log('[autoscore] no new repos to read from cache')
    return []
  }

  const r = getRedis()
  const results: Repo[] = []

  await Promise.all(
    newRepos.map(async (repo) => {
      const cached = await readCachedScore(r, repo.name)
      if (cached) results.push(cached)
    }),
  )

  console.log(`[autoscore] cache-only returning ${results.length} scored repos`)
  return results
}

// CALL THIS FROM AN API ROUTE OR ADMIN ACTION, NOT app/page.tsx
export async function runAutoScores(newRepos: RawRepo[]): Promise<Repo[]> {
  if (!newRepos.length) {
    console.log('[autoscore] no new repos to score')
    return []
  }

  console.log(`[autoscore] ${newRepos.length} unscored repos found`)

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

  toInfer.sort(
    (a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
  )

  const batch = toInfer.slice(0, MAX_NEW_PER_RUN)
  if (toInfer.length > MAX_NEW_PER_RUN) {
    console.log(
      `[autoscore] capping at ${MAX_NEW_PER_RUN} this run, ${toInfer.length - MAX_NEW_PER_RUN} deferred`
    )
  }

  for (const repo of batch) {
    const scored = await inferScore(repo)
    if (scored) {
      try {
        await r.set(`${CACHE_KEY_PREFIX}${repo.name}`, scored, {
          ex: 60 * 60 * 24 * 7,
        })
      } catch {
        // non-fatal
      }
      results.push(scored)
    }
  }

  console.log(`[autoscore] run returning ${results.length} total`)
  return results
}

export async function flushAutoScore(repoName: string): Promise<void> {
  const r = getRedis()
  await r.del(`${CACHE_KEY_PREFIX}${repoName}`)
  await r.del(`${CACHE_KEY_PREFIX_V1}${repoName}`)
}

export async function listCachedAutoScores(): Promise<string[]> {
  const r = getRedis()
  try {
    const keysV2 = await r.keys(`${CACHE_KEY_PREFIX}*`)
    const keysV1 = await r.keys(`${CACHE_KEY_PREFIX_V1}*`)
    const names = new Set<string>()
    for (const k of keysV2) names.add(k.replace(CACHE_KEY_PREFIX, ''))
    for (const k of keysV1) {
      const name = k.replace(CACHE_KEY_PREFIX_V1, '')
      if (name && !name.startsWith('v2:')) names.add(name)
    }
    return Array.from(names)
  } catch {
    return []
  }
}
