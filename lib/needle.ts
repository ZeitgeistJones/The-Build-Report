import Anthropic from '@anthropic-ai/sdk'
import { getRedis } from '@/lib/redis'
import { getSlugsRescoredSince } from '@/lib/scoreHistory'
import { getRescoreSummaries, type RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import { REPOS } from '@/lib/scores'

const NEEDLE_KEY_PREFIX = 'build-report:needle:'
const NEEDLE_TTL_SEC = 72 * 3600
const EASTERN_TZ = 'America/New_York'

export interface NeedleData {
  text: string
  dateKey: string
  repoCount: number
  generatedAt: string
}

function dateKeyEastern(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: EASTERN_TZ }).format(d)
}

function needleRedisKey(dateKey: string): string {
  return `${NEEDLE_KEY_PREFIX}${dateKey}`
}

function extractLetter(label: string | null | undefined): string | null {
  if (!label || label === '—') return null
  return label.trim().split(' ')[0]
}

function qualifyingChange(meta: RescoreSummaryRecord): boolean {
  const biOld = extractLetter(meta.oldBuilderIntegrity)
  const biNew = extractLetter(meta.newBuilderIntegrity)
  if (biOld && biNew && biOld !== biNew) return true

  const ecOld = extractLetter(meta.oldTokenMechanic)
  const ecNew = extractLetter(meta.newTokenMechanic)
  if (ecOld && ecNew && ecOld !== ecNew) return true
  if (!ecOld && ecNew) return true

  return false
}

export async function generateAndCacheNeedle(): Promise<NeedleData | null> {
  const redis = getRedis()
  const since = Date.now() - 24 * 3600 * 1000
  const slugs = await getSlugsRescoredSince(since)
  if (!slugs.length) return null

  const summaries = await getRescoreSummaries(slugs)
  const nameBySlug = new Map(REPOS.map(r => [r.githubSlug, r.name]))

  const qualifying = Object.entries(summaries)
    .filter(([, meta]) => qualifyingChange(meta))
    .map(([slug, meta]) => ({
      name: nameBySlug.get(slug) ?? slug,
      biOld: meta.oldBuilderIntegrity,
      biNew: meta.newBuilderIntegrity,
      ecOld: meta.oldTokenMechanic,
      ecNew: meta.newTokenMechanic,
      deltaHeader: meta.deltaHeader,
    }))

  if (!qualifying.length) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const lines = qualifying
    .map(q => {
      const parts: string[] = []
      if (q.biOld !== q.biNew) parts.push(`builder standards ${q.biOld} → ${q.biNew}`)
      if (q.ecOld !== q.ecNew) parts.push(`holder economics ${q.ecOld ?? '—'} → ${q.ecNew}`)
      return `${q.name}: ${parts.join(', ')}${q.deltaHeader ? ` (${q.deltaHeader})` : ''}`
    })
    .join('\n')

  const prompt = `You write a very short daily column called "The Needle" for a crypto ecosystem scoring site. It highlights which repos had a grade change today and why, in plain English. Here is today's qualifying grade changes:

${lines}

Write 2-3 sentences total, no more. Mention the most significant move by name and why it moved. Casual, direct, no fluff, no headers, no bullet points. Just plain prose.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()

  if (!text) return null

  const dateKey = dateKeyEastern()
  const data: NeedleData = {
    text,
    dateKey,
    repoCount: qualifying.length,
    generatedAt: new Date().toISOString(),
  }

  await redis.set(needleRedisKey(dateKey), data, { ex: NEEDLE_TTL_SEC })
  return data
}

export async function getNeedle(): Promise<NeedleData | null> {
  try {
    const redis = getRedis()
    const dateKey = dateKeyEastern()
    const cached = await redis.get<NeedleData>(needleRedisKey(dateKey))
    return cached ?? null
  } catch {
    return null
  }
}
