import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { getRedis } from '@/lib/redis'
import { fetchAllEpisodes, ipfsToGatewayUrl, type SlopEpisode } from '@/lib/web3/slopComputer'
import { REPOS } from '@/lib/scores'

const MENTION_KEY_PREFIX = 'build-report:podcast-mention:'
const PENDING_SET_KEY = 'build-report:podcast-mentions-pending'
const PUBLISHED_SET_KEY = 'build-report:podcast-mentions-published'
const SCANNED_EPISODES_KEY = 'build-report:podcast-scanned-episodes'

export type PodcastMention = {
  id: string
  repoSlug: string
  episodeName: string
  episodeSlug: string
  speaker: string
  text: string
  approxTimestampSec: number
  confirmedAt: string
  status: 'pending' | 'published'
  publishedAt: string | null
}

type TranscriptLine = {
  ts: number
  address: string
  handle: string | null
  text: string
  source: string
}

function mentionKey(id: string) {
  return `${MENTION_KEY_PREFIX}${id}`
}

function makeMentionId(repoSlug: string, episodeSlug: string, text: string): string {
  return createHash('sha256').update(`${repoSlug}:${episodeSlug}:${text}`).digest('hex').slice(0, 16)
}

function candidateKeywords(repoSlug: string, repoName: string): string[] {
  const variants = new Set<string>()
  variants.add(repoSlug.toLowerCase())
  variants.add(repoSlug.toLowerCase().replace(/-/g, ' '))
  if (repoName) variants.add(repoName.toLowerCase())
  return Array.from(variants).filter(v => v.length >= 4)
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function fetchTranscriptLines(transcriptUri: string): Promise<TranscriptLine[]> {
  try {
    const url = ipfsToGatewayUrl(transcriptUri)
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return []
    const text = await res.text()
    const lines: TranscriptLine[] = []
    for (const raw of text.split('\n')) {
      const trimmed = raw.trim()
      if (!trimmed) continue
      try {
        const obj = JSON.parse(trimmed)
        if (obj.source === 'live' && typeof obj.text === 'string') {
          lines.push({
            ts: obj.ts,
            address: obj.address,
            handle: obj.handle ?? null,
            text: obj.text,
            source: obj.source,
          })
        }
      } catch {
        // skip malformed line
      }
    }
    return lines
  } catch {
    return []
  }
}

/**
 * Manifest field names are unconfirmed — this repo has never fetched a real
 * manifest JSON, only a transcript file directly. Try several likely key
 * names defensively; if mentionsFound stays 0 across many episodes, this is
 * the first thing to check by logging a raw manifest fetch.
 */
function extractTranscriptUri(manifest: Record<string, unknown>): string | null {
  const candidates = ['transcript', 'transcriptCid', 'transcriptUri', 'transcript_cid']
  for (const key of candidates) {
    const val = manifest[key]
    if (typeof val === 'string' && val.length > 0) {
      return val.startsWith('ipfs://') ? val : `ipfs://${val}`
    }
  }
  return null
}

async function confirmMentionsWithHaiku(
  repoSlug: string,
  repoContext: string,
  candidates: { text: string; handle: string | null; ts: number }[],
): Promise<{ text: string; handle: string | null; ts: number }[]> {
  if (!candidates.length) return []

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const lines = candidates.map((c, i) => `${i}: ${c.text}`).join('\n')

  const prompt = `A podcast transcript contains these lines that mention a word matching the GitHub project "${repoSlug}" (${repoContext || 'no description available'}). Some may be coincidental word matches, not actual references to this specific project.

${lines}

Reply with ONLY a comma-separated list of the line numbers (e.g. "0,2") that are genuinely talking about this specific project. If none are genuine, reply with "none".`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()

    if (text.toLowerCase().includes('none')) return []

    const indices = text
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isInteger(n) && n >= 0 && n < candidates.length)

    return indices.map(i => candidates[i])
  } catch {
    return []
  }
}

export async function scanEpisodeForMentions(episode: SlopEpisode): Promise<PodcastMention[]> {
  if (!episode.manifest) return []

  const manifest = await fetchJson<Record<string, unknown>>(ipfsToGatewayUrl(episode.manifest))
  if (!manifest) return []

  const transcriptUri = extractTranscriptUri(manifest)
  if (!transcriptUri) return []

  const lines = await fetchTranscriptLines(transcriptUri)
  if (!lines.length) return []

  const startTs = lines[0]?.ts ?? Number(episode.datetime) * 1000
  const results: PodcastMention[] = []

  for (const repo of REPOS) {
    const keywords = candidateKeywords(repo.githubSlug, repo.name)
    const candidates = lines
      .filter(line => keywords.some(kw => line.text.toLowerCase().includes(kw)))
      .map(line => ({ text: line.text, handle: line.handle, ts: line.ts }))

    if (!candidates.length) continue

    const confirmed = await confirmMentionsWithHaiku(repo.githubSlug, repo.verdict ?? '', candidates)

    for (const c of confirmed) {
      const id = makeMentionId(repo.githubSlug, episode.slug, c.text)
      results.push({
        id,
        repoSlug: repo.githubSlug,
        episodeName: episode.name,
        episodeSlug: episode.slug,
        speaker: c.handle ?? 'unknown',
        text: c.text,
        approxTimestampSec: Math.max(0, Math.round((c.ts - startTs) / 1000)),
        confirmedAt: new Date().toISOString(),
        status: 'pending',
        publishedAt: null,
      })
    }
  }

  return results
}

export async function scanNewEpisodes(): Promise<{ scanned: number; mentionsFound: number }> {
  const redis = getRedis()
  const episodes = await fetchAllEpisodes()

  const scannedIds = new Set<string>(
    (await redis.smembers<string[]>(SCANNED_EPISODES_KEY).catch(() => [])) ?? [],
  )
  const unscanned = episodes.filter(ep => !scannedIds.has(ep.id))
  let mentionsFound = 0

  for (const episode of unscanned) {
    const mentions = await scanEpisodeForMentions(episode)
    for (const mention of mentions) {
      await redis.set(mentionKey(mention.id), mention, { ex: 60 * 60 * 24 * 365 })
      await redis.sadd(PENDING_SET_KEY, mention.id)
      mentionsFound++
    }
    await redis.sadd(SCANNED_EPISODES_KEY, episode.id)
  }

  return { scanned: unscanned.length, mentionsFound }
}

export async function getPendingMentions(): Promise<PodcastMention[]> {
  try {
    const redis = getRedis()
    const ids = (await redis.smembers<string[]>(PENDING_SET_KEY)) ?? []
    if (!ids.length) return []
    const keys = ids.map(mentionKey)
    const values = await redis.mget<(PodcastMention | null)[]>(...keys)
    return values
      .filter((v): v is PodcastMention => Boolean(v))
      .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))
  } catch {
    return []
  }
}

export async function publishMention(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = await redis.get<PodcastMention>(mentionKey(id))
    if (!mention) return false
    const updated: PodcastMention = { ...mention, status: 'published', publishedAt: new Date().toISOString() }
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    await redis.srem(PENDING_SET_KEY, id)
    await redis.sadd(PUBLISHED_SET_KEY, id)
    return true
  } catch {
    return false
  }
}

export async function dismissMention(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    await redis.srem(PENDING_SET_KEY, id)
    await redis.del(mentionKey(id))
    return true
  } catch {
    return false
  }
}

export async function getPublishedMentions(): Promise<PodcastMention[]> {
  try {
    const redis = getRedis()
    const ids = (await redis.smembers<string[]>(PUBLISHED_SET_KEY)) ?? []
    if (!ids.length) return []
    const keys = ids.map(mentionKey)
    const values = await redis.mget<(PodcastMention | null)[]>(...keys)
    return values.filter((v): v is PodcastMention => Boolean(v))
  } catch {
    return []
  }
}

export async function getFreshMentionsForRepo(repoSlug: string, withinDays = 30): Promise<PodcastMention[]> {
  const all = await getPublishedMentions()
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000
  return all.filter(m => m.repoSlug === repoSlug && m.publishedAt && Date.parse(m.publishedAt) >= cutoff)
}

export async function getArchivedMentionsForRepo(repoSlug: string, withinDays = 30): Promise<PodcastMention[]> {
  const all = await getPublishedMentions()
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000
  return all.filter(m => m.repoSlug === repoSlug && m.publishedAt && Date.parse(m.publishedAt) < cutoff)
}
