import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { getRedis } from '@/lib/redis'
import { fetchTweetEmbed } from '@/lib/twitterEmbed'
import { REPOS } from '@/lib/scores'
import { stripMarkdown } from '@/lib/textCleanup'
import { normieVoiceGuidance } from '@/lib/normieVoice'

const KEY_PREFIX = 'build-report:spotted:'
const PENDING_SET_KEY = 'build-report:spotted-pending'
const PUBLISHED_SET_KEY = 'build-report:spotted-published'

export type SpottedEntry = {
  id: string
  tweetUrl: string
  embedHtml: string
  authorName: string
  tweetText: string
  accountContext: string
  extraContext: string
  repoSlug: string | null
  writeup: string
  /** Optional plain-English version for Normie mode; older entries omit this. */
  writeupNormie?: string
  status: 'draft' | 'published'
  createdAt: string
  publishedAt: string | null
}

function entryKey(id: string) {
  return `${KEY_PREFIX}${id}`
}

async function generateWriteup(params: {
  tweetText: string
  authorName: string
  accountContext: string
  extraContext: string
  repoSlug: string | null
}): Promise<{ writeup: string; writeupNormie?: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const repo = REPOS.find(r => r.githubSlug === params.repoSlug)
  const repoContext = repo
    ? `${repo.name} — ${repo.verdict ?? 'no summary available'}`
    : 'a project in the clawdbotatg ecosystem (not a specific tracked repo)'

  const prompt = `You write a very short column called "Spotted" — noteworthy mentions of the clawdbotatg ecosystem seen on X (Twitter). Here's the context:

Author: ${params.authorName}
Who they are: ${params.accountContext || 'unknown — no context provided'}
Tweet text: "${params.tweetText}"
Repo/project being referenced: ${repoContext}
${params.extraContext ? `Additional context: ${params.extraContext}` : ''}

Write a standard column and a plain-English version. For the standard writeup: 2-3 sentences — identify who the author is and why it's notable they said this, then summarize what they said. Casual, direct, no fluff, no headers. Just plain prose. Don't invent facts about the author beyond what's given.

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "writeup": "2-3 sentences following the instructions above.",
  "writeupNormie": "Same facts as writeup, rewritten for someone who knows nothing about code or crypto."
}

NORMIE VOICE GUIDE (applies to writeupNormie only):
${normieVoiceGuidance('spotted')}`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = response.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!raw) return { writeup: '' }

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { writeup: stripMarkdown(raw).trim() }
    }
    const parsed = JSON.parse(jsonMatch[0]) as { writeup?: string; writeupNormie?: string }
    const writeup = typeof parsed.writeup === 'string' ? stripMarkdown(parsed.writeup).trim() : ''
    if (!writeup) return { writeup: '' }
    const writeupNormie =
      typeof parsed.writeupNormie === 'string' ? stripMarkdown(parsed.writeupNormie).trim() : ''
    return writeupNormie ? { writeup, writeupNormie } : { writeup }
  } catch {
    return { writeup: '' }
  }
}

export async function generateSpottedDraft(params: {
  tweetUrl: string
  tweetText: string
  accountContext: string
  extraContext: string
  repoSlug: string | null
}): Promise<SpottedEntry | null> {
  const embed = await fetchTweetEmbed(params.tweetUrl)
  if (!embed) return null

  const generated = await generateWriteup({
    tweetText: params.tweetText,
    authorName: embed.authorName,
    accountContext: params.accountContext,
    extraContext: params.extraContext,
    repoSlug: params.repoSlug,
  })
  if (!generated.writeup) return null

  const redis = getRedis()
  const id = randomUUID()
  const entry: SpottedEntry = {
    id,
    tweetUrl: params.tweetUrl,
    embedHtml: embed.html,
    authorName: embed.authorName,
    tweetText: params.tweetText,
    accountContext: params.accountContext,
    extraContext: params.extraContext,
    repoSlug: params.repoSlug,
    writeup: generated.writeup,
    ...(generated.writeupNormie ? { writeupNormie: generated.writeupNormie } : {}),
    status: 'draft',
    createdAt: new Date().toISOString(),
    publishedAt: null,
  }

  await redis.set(entryKey(id), entry, { ex: 60 * 60 * 24 * 365 })
  await redis.sadd(PENDING_SET_KEY, id)
  return entry
}

export async function getDraftEntries(): Promise<SpottedEntry[]> {
  try {
    const redis = getRedis()
    const ids = (await redis.smembers<string[]>(PENDING_SET_KEY)) ?? []
    if (!ids.length) return []
    const values = await redis.mget<(SpottedEntry | null)[]>(...ids.map(entryKey))
    return values
      .filter((v): v is SpottedEntry => Boolean(v))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    return []
  }
}

export async function publishEntry(id: string, writeup?: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const entry = await redis.get<SpottedEntry>(entryKey(id))
    if (!entry) return false
    const nextWriteup = typeof writeup === 'string' && writeup.trim() ? writeup.trim() : entry.writeup
    const writeupChanged = nextWriteup !== entry.writeup
    const updated: SpottedEntry = {
      ...entry,
      writeup: nextWriteup,
      status: 'published',
      publishedAt: new Date().toISOString(),
    }
    if (writeupChanged) delete updated.writeupNormie
    await redis.set(entryKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    await redis.srem(PENDING_SET_KEY, id)
    await redis.sadd(PUBLISHED_SET_KEY, id)
    return true
  } catch {
    return false
  }
}

export async function dismissEntry(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    await redis.srem(PENDING_SET_KEY, id)
    await redis.del(entryKey(id))
    return true
  } catch {
    return false
  }
}

/** Rewrite an existing Spotted writeup into plain-English (same facts). */
async function rewriteSpottedWriteupNormie(writeup: string): Promise<string | null> {
  if (!writeup.trim() || !process.env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `Rewrite this Spotted column writeup into plain English for someone who knows nothing about code or crypto. Keep the same facts and names. Do not add new claims.

Writeup:
"""
${writeup}
"""

Return ONLY the rewritten paragraph (no JSON, no labels, no markdown).

NORMIE VOICE GUIDE:
${normieVoiceGuidance('spotted')}`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = stripMarkdown(
      response.content.map(b => (b.type === 'text' ? b.text : '')).join(''),
    ).trim()
    return text || null
  } catch {
    return null
  }
}

/** Lazy-backfill writeupNormie for published entries that predate Plain English mode. */
async function ensureSpottedWriteupNormie(entry: SpottedEntry): Promise<SpottedEntry> {
  if (entry.writeupNormie?.trim() || !entry.writeup.trim()) return entry
  const writeupNormie = await rewriteSpottedWriteupNormie(entry.writeup)
  if (!writeupNormie) return entry
  const updated: SpottedEntry = { ...entry, writeupNormie }
  try {
    await getRedis().set(entryKey(entry.id), updated, { ex: 60 * 60 * 24 * 365 })
  } catch {
    // still return in-memory so this request can show Plain English
  }
  return updated
}

export async function getLatestPublished(): Promise<SpottedEntry | null> {
  try {
    const redis = getRedis()
    const ids = (await redis.smembers<string[]>(PUBLISHED_SET_KEY)) ?? []
    if (!ids.length) return null
    const values = await redis.mget<(SpottedEntry | null)[]>(...ids.map(entryKey))
    const valid = values.filter((v): v is SpottedEntry => Boolean(v))
    if (!valid.length) return null
    const latest = valid.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))[0]
    return ensureSpottedWriteupNormie(latest)
  } catch {
    return null
  }
}
