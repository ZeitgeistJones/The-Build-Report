import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { getRedis } from '@/lib/redis'
import { fetchTweetEmbed } from '@/lib/twitterEmbed'
import { REPOS } from '@/lib/scores'

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
}): Promise<string> {
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

Write 2-3 sentences: identify who the author is and why it's notable they said this, then summarize what they said. Casual, direct, no fluff, no headers. Just plain prose. Don't invent facts about the author beyond what's given.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    return response.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
  } catch {
    return ''
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

  const writeup = await generateWriteup({
    tweetText: params.tweetText,
    authorName: embed.authorName,
    accountContext: params.accountContext,
    extraContext: params.extraContext,
    repoSlug: params.repoSlug,
  })
  if (!writeup) return null

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
    writeup,
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

export async function publishEntry(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const entry = await redis.get<SpottedEntry>(entryKey(id))
    if (!entry) return false
    const updated: SpottedEntry = { ...entry, status: 'published', publishedAt: new Date().toISOString() }
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

export async function getLatestPublished(): Promise<SpottedEntry | null> {
  try {
    const redis = getRedis()
    const ids = (await redis.smembers<string[]>(PUBLISHED_SET_KEY)) ?? []
    if (!ids.length) return null
    const values = await redis.mget<(SpottedEntry | null)[]>(...ids.map(entryKey))
    const valid = values.filter((v): v is SpottedEntry => Boolean(v))
    if (!valid.length) return null
    return valid.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))[0]
  } catch {
    return null
  }
}
