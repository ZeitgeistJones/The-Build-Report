import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { getRedis } from '@/lib/redis'
import { fetchAllEpisodes, fetchIpfsText, type SlopEpisode } from '@/lib/web3/slopComputer'
import { REPOS } from '@/lib/scores'

const MENTION_KEY_PREFIX = 'build-report:podcast-mention:'
const PENDING_SET_KEY = 'build-report:podcast-mentions-pending'
const CANDIDATE_SET_KEY = 'build-report:podcast-mentions-candidate'
const PUBLISHED_SET_KEY = 'build-report:podcast-mentions-published'
const SCANNED_EPISODES_KEY = 'build-report:podcast-scanned-episodes'
const MODE_KEY = 'build-report:overheard-mode'

export type OverheardMode = 'automatic' | 'manual'

export type PodcastMention = {
  id: string
  repoSlug: string
  episodeName: string
  episodeSlug: string
  speaker: string
  text: string
  approxTimestampSec: number
  confirmedAt: string
  status: 'candidate' | 'pending' | 'published'
  userContext: string | null
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

async function fetchJsonFromIpfs<T>(ipfsUri: string): Promise<T | null> {
  try {
    const text = await fetchIpfsText(ipfsUri, 15_000)
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

async function fetchTranscriptLines(transcriptUri: string): Promise<TranscriptLine[]> {
  try {
    const text = await fetchIpfsText(transcriptUri, 20_000)
    if (!text) return []
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
 * Slop.Computer manifests store transcript as `{ cid, segmentCount }` (confirmed
 * via IPFS probe). Also accept legacy string / alternate key shapes.
 */
function extractTranscriptUri(manifest: Record<string, unknown>): string | null {
  const candidates = ['transcript', 'transcriptCid', 'transcriptUri', 'transcript_cid']
  for (const key of candidates) {
    const val = manifest[key]
    if (typeof val === 'string' && val.length > 0) {
      return val.startsWith('ipfs://') ? val : `ipfs://${val}`
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const cid = (val as { cid?: unknown }).cid
      if (typeof cid === 'string' && cid.length > 0) {
        return cid.startsWith('ipfs://') ? cid : `ipfs://${cid}`
      }
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
    const text = response.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
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

export async function getOverheardMode(): Promise<OverheardMode> {
  try {
    const redis = getRedis()
    const mode = await redis.get<string>(MODE_KEY)
    return mode === 'manual' ? 'manual' : 'automatic'
  } catch {
    return 'automatic'
  }
}

export async function setOverheardMode(mode: OverheardMode): Promise<void> {
  const redis = getRedis()
  await redis.set(MODE_KEY, mode)
}

export async function scanEpisodeForMentions(
  episode: SlopEpisode,
  mode: OverheardMode,
): Promise<PodcastMention[]> {
  if (!episode.manifest) return []

  const manifest = await fetchJsonFromIpfs<Record<string, unknown>>(episode.manifest)
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

    if (mode === 'automatic') {
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
          userContext: null,
          publishedAt: null,
        })
      }
    } else {
      // manual mode — skip Haiku, surface every raw keyword hit as a candidate for human review
      for (const c of candidates) {
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
          status: 'candidate',
          userContext: null,
          publishedAt: null,
        })
      }
    }
  }

  return results
}

export async function clearScannedEpisodes(): Promise<number> {
  const redis = getRedis()
  const ids = (await redis.smembers<string[]>(SCANNED_EPISODES_KEY).catch(() => [])) ?? []
  await redis.del(SCANNED_EPISODES_KEY)
  return ids.length
}

async function persistMentions(mentions: PodcastMention[]): Promise<number> {
  const redis = getRedis()
  let mentionsFound = 0
  for (const mention of mentions) {
    await redis.set(mentionKey(mention.id), mention, { ex: 60 * 60 * 24 * 365 })
    await redis.sadd(mention.status === 'candidate' ? CANDIDATE_SET_KEY : PENDING_SET_KEY, mention.id)
    mentionsFound++
  }
  return mentionsFound
}

export async function scanNextUnscanned(): Promise<{
  scanned: number
  mentionsFound: number
  mode: OverheardMode
  episodeName: string | null
  episodeSlug: string | null
  remaining: number
  totalEpisodes: number
}> {
  const redis = getRedis()
  const mode = await getOverheardMode()
  const episodes = await fetchAllEpisodes()
  const scannedIds = new Set<string>(
    (await redis.smembers<string[]>(SCANNED_EPISODES_KEY).catch(() => [])) ?? [],
  )
  const next = episodes.find(ep => !scannedIds.has(ep.id))
  if (!next) {
    return {
      scanned: 0,
      mentionsFound: 0,
      mode,
      episodeName: null,
      episodeSlug: null,
      remaining: 0,
      totalEpisodes: episodes.length,
    }
  }

  const mentions = await scanEpisodeForMentions(next, mode)
  const mentionsFound = await persistMentions(mentions)
  await redis.sadd(SCANNED_EPISODES_KEY, next.id)
  const remaining = episodes.filter(ep => ep.id !== next.id && !scannedIds.has(ep.id)).length

  return {
    scanned: 1,
    mentionsFound,
    mode,
    episodeName: next.name,
    episodeSlug: next.slug,
    remaining,
    totalEpisodes: episodes.length,
  }
}

export async function scanNewEpisodes(opts?: {
  rescanAll?: boolean
}): Promise<{ scanned: number; mentionsFound: number; mode: OverheardMode; totalEpisodes: number; skippedAlreadyScanned: number }> {
  const redis = getRedis()
  const mode = await getOverheardMode()
  const episodes = await fetchAllEpisodes()

  if (opts?.rescanAll) {
    await redis.del(SCANNED_EPISODES_KEY)
  }

  const scannedIds = new Set<string>(
    (await redis.smembers<string[]>(SCANNED_EPISODES_KEY).catch(() => [])) ?? [],
  )
  const unscanned = episodes.filter(ep => !scannedIds.has(ep.id))
  let mentionsFound = 0

  for (const episode of unscanned) {
    const mentions = await scanEpisodeForMentions(episode, mode)
    mentionsFound += await persistMentions(mentions)
    await redis.sadd(SCANNED_EPISODES_KEY, episode.id)
  }

  return {
    scanned: unscanned.length,
    mentionsFound,
    mode,
    totalEpisodes: episodes.length,
    skippedAlreadyScanned: episodes.length - unscanned.length,
  }
}

async function getMentionsFromSet(setKey: string): Promise<PodcastMention[]> {
  try {
    const redis = getRedis()
    const ids = (await redis.smembers<string[]>(setKey)) ?? []
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

export async function getCandidateMentions(): Promise<PodcastMention[]> {
  return getMentionsFromSet(CANDIDATE_SET_KEY)
}

export async function getPendingMentions(): Promise<PodcastMention[]> {
  return getMentionsFromSet(PENDING_SET_KEY)
}

export async function addContextToCandidate(id: string, context: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = await redis.get<PodcastMention>(mentionKey(id))
    if (!mention || mention.status !== 'candidate') return false
    const updated: PodcastMention = { ...mention, userContext: context }
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    return true
  } catch {
    return false
  }
}

export async function confirmCandidate(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = await redis.get<PodcastMention>(mentionKey(id))
    if (!mention || mention.status !== 'candidate') return false
    const updated: PodcastMention = { ...mention, status: 'pending' }
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    await redis.srem(CANDIDATE_SET_KEY, id)
    await redis.sadd(PENDING_SET_KEY, id)
    return true
  } catch {
    return false
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
    await redis.srem(CANDIDATE_SET_KEY, id)
    await redis.del(mentionKey(id))
    return true
  } catch {
    return false
  }
}

export async function getPublishedMentions(): Promise<PodcastMention[]> {
  return getMentionsFromSet(PUBLISHED_SET_KEY)
}
