import Anthropic from '@anthropic-ai/sdk'
import { getRedis } from '@/lib/redis'
import { fetchAllEpisodes, ipfsToGatewayUrl, type SlopEpisode } from '@/lib/web3/slopComputer'
import { REPOS } from '@/lib/scores'

const MENTIONS_KEY_PREFIX = 'build-report:podcast-mentions:'
const SCANNED_EPISODES_KEY = 'build-report:podcast-scanned-episodes'

export type PodcastMention = {
  repoSlug: string
  episodeName: string
  episodeSlug: string
  speaker: string
  text: string
  approxTimestampSec: number
  confirmedAt: string
}

type TranscriptLine = {
  ts: number
  address: string
  handle: string | null
  text: string
  source: string
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
 * names defensively; log if none match so this can be tightened later.
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
  repoDescription: string,
  candidates: { text: string; handle: string | null; ts: number }[],
): Promise<{ text: string; handle: string | null; ts: number }[]> {
  if (!candidates.length) return []

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const lines = candidates
    .map((c, i) => `${i}: ${c.text}`)
    .join('\n')

  const prompt = `A podcast transcript contains these lines that mention a word matching the GitHub project "${repoSlug}" (${repoDescription || 'no description available'}). Some may be coincidental word matches, not actual references to this specific project.

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
      .filter(line => {
        const lower = line.text.toLowerCase()
        return keywords.some(kw => lower.includes(kw))
      })
      .map(line => ({
        text: line.text,
        handle: line.handle,
        ts: line.ts,
      }))

    if (!candidates.length) continue

    // Repo has no description field — pass verdict as lightweight context for Haiku.
    const confirmed = await confirmMentionsWithHaiku(repo.githubSlug, repo.verdict ?? '', candidates)

    for (const c of confirmed) {
      results.push({
        repoSlug: repo.githubSlug,
        episodeName: episode.name,
        episodeSlug: episode.slug,
        speaker: c.handle ?? 'unknown',
        text: c.text,
        approxTimestampSec: Math.max(0, Math.round((c.ts - startTs) / 1000)),
        confirmedAt: new Date().toISOString(),
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
      const key = `${MENTIONS_KEY_PREFIX}${mention.repoSlug}`
      await redis.lpush(key, mention)
      await redis.ltrim(key, 0, 19)
      await redis.expire(key, 60 * 60 * 24 * 365)
      mentionsFound++
    }
    await redis.sadd(SCANNED_EPISODES_KEY, episode.id)
  }

  return { scanned: unscanned.length, mentionsFound }
}

export async function getPodcastMentions(repoSlug: string): Promise<PodcastMention[]> {
  try {
    const redis = getRedis()
    const raw = await redis.lrange<PodcastMention>(`${MENTIONS_KEY_PREFIX}${repoSlug}`, 0, 19)
    return raw ?? []
  } catch {
    return []
  }
}
