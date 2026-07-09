import Anthropic from '@anthropic-ai/sdk'
import { getRedis } from '@/lib/redis'
import { getPublishedMentions, type PodcastMention } from '@/lib/podcastMentions'

const OVERHEARD_KEY_PREFIX = 'build-report:overheard:'
const OVERHEARD_TTL_SEC = 72 * 3600
const EASTERN_TZ = 'America/New_York'

export interface OverheardData {
  text: string
  format: 'prose' | 'list'
  mentionCount: number
  dateKey: string
  generatedAt: string
}

function dateKeyEastern(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: EASTERN_TZ }).format(d)
}

function overheardRedisKey(dateKey: string): string {
  return `${OVERHEARD_KEY_PREFIX}${dateKey}`
}

async function getMentionsPublishedLast24h(): Promise<PodcastMention[]> {
  const all = await getPublishedMentions()
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  return all.filter(m => m.publishedAt && Date.parse(m.publishedAt) >= cutoff)
}

export async function generateAndCacheOverheard(): Promise<OverheardData | null> {
  const redis = getRedis()
  const mentions = await getMentionsPublishedLast24h()
  if (!mentions.length) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const format: 'prose' | 'list' = mentions.length <= 2 ? 'prose' : 'list'

  const lines = mentions
    .map((m, i) => `${i}: [${m.repoSlug}] ${m.speaker} on "${m.episodeName}": "${m.text}"`)
    .join('\n')

  const prompt = format === 'prose'
    ? `You write a very short daily column called "Overheard" — mentions of tracked repos spotted on the Slop.Computer podcast. Here are today's confirmed mentions:

${lines}

Write exactly 2-3 sentences total: one opening sentence, naturally naming the repo(s) mentioned, then one closing sentence. Casual, direct, no fluff, no headers, no bullet points. Just plain prose.`
    : `You write a very short daily column called "Overheard" — mentions of tracked repos spotted on the Slop.Computer podcast. Here are today's confirmed mentions:

${lines}

There are more than 2 mentions today, so write ONE sentence per mention, each on its own line, formatted exactly as: "RepoName: sentence." No intro, no closer, no extra commentary — just the list of one-sentence-per-mention lines.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()

    if (!text) return null

    const dateKey = dateKeyEastern()
    const data: OverheardData = {
      text,
      format,
      mentionCount: mentions.length,
      dateKey,
      generatedAt: new Date().toISOString(),
    }

    await redis.set(overheardRedisKey(dateKey), data, { ex: OVERHEARD_TTL_SEC })
    return data
  } catch {
    return null
  }
}

export async function getOverheard(): Promise<OverheardData | null> {
  try {
    const redis = getRedis()
    const dateKey = dateKeyEastern()
    const cached = await redis.get<OverheardData>(overheardRedisKey(dateKey))
    return cached ?? null
  } catch {
    return null
  }
}
