import Anthropic from '@anthropic-ai/sdk'
import { createHash, randomUUID } from 'crypto'
import { getRedis } from '@/lib/redis'
import { fetchAllEpisodes, fetchIpfsText, episodePublicUrl, type SlopEpisode } from '@/lib/web3/slopComputer'
import { getGitHubStatsForDisplay } from '@/lib/githubStatsSnapshot'
import { generateOverheardWriteup } from '@/lib/overheardWriteup'
import { REPOS } from '@/lib/scores'

/** Prefer the full clawdbotatg trackable set from the GitHub snapshot; fall back to scored REPOS. */
async function getReposForMentionScan(): Promise<Array<{ githubSlug: string; name: string; context: string }>> {
  try {
    const stats = await getGitHubStatsForDisplay()
    const trackable = stats?.trackableRepos ?? []
    if (trackable.length > 0) {
      return trackable.map(r => ({
        githubSlug: r.name,
        name: r.name,
        context: r.description ?? '',
      }))
    }
  } catch {
    // fall through
  }
  return REPOS.map(r => ({
    githubSlug: r.githubSlug,
    name: r.name,
    context: r.verdict ?? '',
  }))
}

const MENTION_KEY_PREFIX = 'build-report:podcast-mention:'
const PENDING_SET_KEY = 'build-report:podcast-mentions-pending'
const CANDIDATE_SET_KEY = 'build-report:podcast-mentions-candidate'
const PUBLISHED_SET_KEY = 'build-report:podcast-mentions-published'
const SCANNED_EPISODES_KEY = 'build-report:podcast-scanned-episodes'
const MODE_KEY = 'build-report:overheard-mode'

export type OverheardMode = 'automatic' | 'manual'

export type OverheardQuote = {
  speaker: string
  text: string
  approxTimestampSec: number
  candidateId?: string
}

export type OverheardEntry = {
  id: string
  kind: 'single' | 'thread'
  repoSlug: string
  episodeName: string
  episodeSlug: string
  episodeUrl: string | null
  episodePublishedAt: string | null
  quotes: OverheardQuote[]
  writeup: string
  /** Optional plain-English version for Normie mode; older entries omit this. */
  writeupNormie?: string
  status: 'candidate' | 'pending' | 'published' | 'archived' | 'taken_down'
  userContext: string | null
  scannedAt: string | null
  confirmedAt: string | null
  publishedAt: string | null
}

/** @deprecated Use OverheardEntry */
export type PodcastMention = OverheardEntry

function episodePublishedAtIso(episode: SlopEpisode): string {
  return new Date(Number(episode.datetime) * 1000).toISOString()
}

/** Normalize legacy flat mention records from Redis into OverheardEntry. */
export function normalizeOverheardEntry(raw: unknown): OverheardEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.repoSlug !== 'string') return null

  if (Array.isArray(r.quotes) && r.quotes.length > 0) {
    return {
      id: r.id,
      kind: r.kind === 'thread' ? 'thread' : 'single',
      repoSlug: r.repoSlug,
      episodeName: String(r.episodeName ?? ''),
      episodeSlug: String(r.episodeSlug ?? ''),
      episodeUrl: typeof r.episodeUrl === 'string' ? r.episodeUrl : null,
      episodePublishedAt: typeof r.episodePublishedAt === 'string' ? r.episodePublishedAt : null,
      quotes: r.quotes as OverheardQuote[],
      writeup: typeof r.writeup === 'string' ? r.writeup : '',
      ...(typeof r.writeupNormie === 'string' && r.writeupNormie.trim()
        ? { writeupNormie: r.writeupNormie }
        : {}),
      status:
        r.status === 'candidate' ||
        r.status === 'pending' ||
        r.status === 'published' ||
        r.status === 'archived' ||
        r.status === 'taken_down'
          ? r.status
          : 'candidate',
      userContext: typeof r.userContext === 'string' ? r.userContext : null,
      scannedAt: typeof r.scannedAt === 'string' ? r.scannedAt : null,
      confirmedAt: typeof r.confirmedAt === 'string' ? r.confirmedAt : null,
      publishedAt: typeof r.publishedAt === 'string' ? r.publishedAt : null,
    }
  }

  if (typeof r.text === 'string' && typeof r.speaker === 'string') {
    const legacyConfirmed = typeof r.confirmedAt === 'string' ? r.confirmedAt : null
    return {
      id: r.id,
      kind: 'single',
      repoSlug: r.repoSlug,
      episodeName: String(r.episodeName ?? ''),
      episodeSlug: String(r.episodeSlug ?? ''),
      episodeUrl: typeof r.episodeUrl === 'string' ? r.episodeUrl : null,
      episodePublishedAt: typeof r.episodePublishedAt === 'string' ? r.episodePublishedAt : null,
      quotes: [{
        speaker: r.speaker,
        text: r.text,
        approxTimestampSec: typeof r.approxTimestampSec === 'number' ? r.approxTimestampSec : 0,
        candidateId: r.id,
      }],
      writeup: typeof r.writeup === 'string' ? r.writeup : '',
      ...(typeof r.writeupNormie === 'string' && r.writeupNormie.trim()
        ? { writeupNormie: r.writeupNormie }
        : {}),
      status:
        r.status === 'candidate' ||
        r.status === 'pending' ||
        r.status === 'published' ||
        r.status === 'archived' ||
        r.status === 'taken_down'
          ? r.status
          : 'candidate',
      userContext: typeof r.userContext === 'string' ? r.userContext : null,
      scannedAt: legacyConfirmed,
      confirmedAt: r.status === 'pending' || r.status === 'published' ? legacyConfirmed : null,
      publishedAt: typeof r.publishedAt === 'string' ? r.publishedAt : null,
    }
  }

  return null
}

function buildCandidateEntry(params: {
  id: string
  repoSlug: string
  episode: SlopEpisode
  speaker: string
  text: string
  approxTimestampSec: number
  status: 'candidate' | 'pending'
}): OverheardEntry {
  const now = new Date().toISOString()
  return {
    id: params.id,
    kind: 'single',
    repoSlug: params.repoSlug,
    episodeName: params.episode.name,
    episodeSlug: params.episode.slug,
    episodeUrl: episodePublicUrl(params.episode.slug),
    episodePublishedAt: episodePublishedAtIso(params.episode),
    quotes: [{
      speaker: params.speaker,
      text: params.text,
      approxTimestampSec: params.approxTimestampSec,
      candidateId: params.id,
    }],
    writeup: '',
    status: params.status,
    userContext: null,
    scannedAt: now,
    confirmedAt: null,
    publishedAt: null,
  }
}

/** Generate writeup and set confirmedAt once an entry is in pending. */
async function populatePendingWriteup(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || mention.status !== 'pending') return false
    const generated = await generateOverheardWriteup(mention)
    const updated: OverheardEntry = {
      ...mention,
      writeup: generated.writeup,
      ...(generated.writeupNormie ? { writeupNormie: generated.writeupNormie } : { writeupNormie: undefined }),
      confirmedAt: mention.confirmedAt ?? new Date().toISOString(),
    }
    if (!generated.writeupNormie) delete updated.writeupNormie
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    return Boolean(generated.writeup)
  } catch {
    return false
  }
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

/** Bare common words that must never match alone — too many false positives in normal conversation. */
const GENERIC_SINGLE_WORDS = new Set([
  'agent',
  'agents',
  'app',
  'apps',
  'bot',
  'bots',
  'builder',
  'builders',
  'cli',
  'client',
  'cloud',
  'code',
  'core',
  'data',
  'dev',
  'engine',
  'framework',
  'helper',
  'hub',
  'kit',
  'lib',
  'market',
  'platform',
  'plugin',
  'sdk',
  'server',
  'service',
  'services',
  'skill',
  'skills',
  'tool',
  'tools',
  'util',
  'utils',
  'wallet',
  'web',
])

/**
 * Manual per-repo keyword blocklist. Keys are github slugs; values are lowercase
 * keywords/phrases to suppress even if the automated matcher would accept them.
 */
export const KEYWORD_BLOCKLIST: Record<string, string[]> = {
  // Example: 'yet-another-builder-agent': ['builder', 'agent'],
}

/** Extra context tokens that make an ambiguous keyword count as a real mention. */
const ECOSYSTEM_CONTEXT_TOKENS = ['clawd', 'clawdbot', 'clawdbotatg', '$clawd', 'leftclaw']

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const escaped = escapeRegExp(phrase).replace(/\s+/g, '\\s+')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(haystack)
}

function isGenericSingleWord(keyword: string): boolean {
  const trimmed = keyword.trim().toLowerCase()
  if (!trimmed || trimmed.includes(' ') || trimmed.includes('-')) return false
  return GENERIC_SINGLE_WORDS.has(trimmed)
}

function isAmbiguousKeyword(keyword: string): boolean {
  const trimmed = keyword.trim().toLowerCase()
  if (!trimmed) return true
  if (isGenericSingleWord(trimmed)) return true
  // Short single tokens and common 2-word phrases need nearby ecosystem context
  const words = trimmed.split(/[\s-]+/).filter(Boolean)
  if (words.length === 1) return trimmed.length < 8 || GENERIC_SINGLE_WORDS.has(trimmed)
  if (words.length === 2 && words.every(w => GENERIC_SINGLE_WORDS.has(w) || w.length <= 4)) return true
  return false
}

function candidateKeywords(repoSlug: string, repoName: string): string[] {
  const slug = repoSlug.toLowerCase()
  const spaced = slug.replace(/-/g, ' ')
  const variants = new Set<string>()
  variants.add(slug)
  variants.add(spaced)
  if (repoName) variants.add(repoName.toLowerCase())

  const blocked = new Set(
    (KEYWORD_BLOCKLIST[repoSlug] ?? KEYWORD_BLOCKLIST[slug] ?? []).map(k => k.toLowerCase()),
  )

  return Array.from(variants).filter(v => {
    if (v.length < 4) return false
    if (blocked.has(v)) return false
    // Drop bare generic singles entirely — they never match alone
    if (isGenericSingleWord(v)) return false
    return true
  })
}

function contextTokensForRepo(repoSlug: string): string[] {
  const slug = repoSlug.toLowerCase()
  const spaced = slug.replace(/-/g, ' ')
  const tokens = new Set<string>(ECOSYSTEM_CONTEXT_TOKENS)
  tokens.add(slug)
  tokens.add(spaced)
  // Distinctive slug parts (skip generic fillers)
  for (const part of slug.split('-')) {
    if (part.length >= 4 && !GENERIC_SINGLE_WORDS.has(part)) tokens.add(part)
  }
  return Array.from(tokens)
}

/**
 * True if `line` (optionally with neighbors) is a real mention of this repo keyword.
 * Distinctive multi-word / slug matches pass alone; ambiguous terms need nearby context.
 */
function lineMatchesKeyword(
  lineText: string,
  keyword: string,
  repoSlug: string,
  neighborTexts: string[],
): boolean {
  const blocked = new Set(
    (KEYWORD_BLOCKLIST[repoSlug] ?? KEYWORD_BLOCKLIST[repoSlug.toLowerCase()] ?? []).map(k =>
      k.toLowerCase(),
    ),
  )
  const kw = keyword.toLowerCase()
  if (blocked.has(kw)) return false
  if (!containsPhrase(lineText, kw)) return false
  if (!isAmbiguousKeyword(kw)) return true

  const windowText = [lineText, ...neighborTexts].join(' ')
  const contextTokens = contextTokensForRepo(repoSlug).filter(t => t !== kw && t !== kw.replace(/-/g, ' '))
  return contextTokens.some(token => containsPhrase(windowText, token))
}

function findMentionCandidates(
  lines: TranscriptLine[],
  repoSlug: string,
  repoName: string,
): { text: string; handle: string | null; ts: number }[] {
  const keywords = candidateKeywords(repoSlug, repoName)
  if (!keywords.length) return []

  const out: { text: string; handle: string | null; ts: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const neighbors = [lines[i - 1]?.text, lines[i + 1]?.text].filter(
      (t): t is string => typeof t === 'string' && t.length > 0,
    )
    const hit = keywords.some(kw => lineMatchesKeyword(line.text, kw, repoSlug, neighbors))
    if (hit) out.push({ text: line.text, handle: line.handle, ts: line.ts })
  }
  return out
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
): Promise<OverheardEntry[]> {
  if (!episode.manifest) return []

  const manifest = await fetchJsonFromIpfs<Record<string, unknown>>(episode.manifest)
  if (!manifest) return []

  const transcriptUri = extractTranscriptUri(manifest)
  if (!transcriptUri) return []

  const lines = await fetchTranscriptLines(transcriptUri)
  if (!lines.length) return []

  const startTs = lines[0]?.ts ?? Number(episode.datetime) * 1000
  const results: OverheardEntry[] = []
  const repos = await getReposForMentionScan()

  for (const repo of repos) {
    const candidates = findMentionCandidates(lines, repo.githubSlug, repo.name)

    if (!candidates.length) continue

    if (mode === 'automatic') {
      const confirmed = await confirmMentionsWithHaiku(repo.githubSlug, repo.context, candidates)
      for (const c of confirmed) {
        const id = makeMentionId(repo.githubSlug, episode.slug, c.text)
        const entry = buildCandidateEntry({
          id,
          repoSlug: repo.githubSlug,
          episode,
          speaker: c.handle ?? 'unknown',
          text: c.text,
          approxTimestampSec: Math.max(0, Math.round((c.ts - startTs) / 1000)),
          status: 'pending',
        })
        results.push(entry)
      }
    } else {
      for (const c of candidates) {
        const id = makeMentionId(repo.githubSlug, episode.slug, c.text)
        results.push(buildCandidateEntry({
          id,
          repoSlug: repo.githubSlug,
          episode,
          speaker: c.handle ?? 'unknown',
          text: c.text,
          approxTimestampSec: Math.max(0, Math.round((c.ts - startTs) / 1000)),
          status: 'candidate',
        }))
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

async function persistMentions(mentions: OverheardEntry[]): Promise<number> {
  const redis = getRedis()
  let mentionsFound = 0
  const pendingNeedWriteup: string[] = []
  for (const mention of mentions) {
    await redis.set(mentionKey(mention.id), mention, { ex: 60 * 60 * 24 * 365 })
    await redis.sadd(mention.status === 'candidate' ? CANDIDATE_SET_KEY : PENDING_SET_KEY, mention.id)
    if (mention.status === 'pending' && !mention.writeup.trim()) {
      pendingNeedWriteup.push(mention.id)
    }
    mentionsFound++
  }
  if (pendingNeedWriteup.length) {
    void Promise.all(pendingNeedWriteup.map(id => populatePendingWriteup(id)))
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

async function getMentionsFromSet(setKey: string): Promise<OverheardEntry[]> {
  try {
    const redis = getRedis()
    const ids = (await redis.smembers<string[]>(setKey)) ?? []
    if (!ids.length) return []
    const keys = ids.map(mentionKey)
    const values = await redis.mget<unknown[]>(...keys)
    const entries = values
      .map(normalizeOverheardEntry)
      .filter((v): v is OverheardEntry => Boolean(v))

    if (setKey === PUBLISHED_SET_KEY) {
      return entries
        .filter(e => e.status === 'published')
        .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    }
    if (setKey === PENDING_SET_KEY) {
      return entries
        .filter(e => e.status === 'pending')
        .sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''))
    }
    return entries.sort((a, b) => (b.scannedAt ?? '').localeCompare(a.scannedAt ?? ''))
  } catch {
    return []
  }
}

export async function getCandidateMentions(): Promise<OverheardEntry[]> {
  return getMentionsFromSet(CANDIDATE_SET_KEY)
}

export async function getPendingMentions(): Promise<OverheardEntry[]> {
  return getMentionsFromSet(PENDING_SET_KEY)
}

export async function addContextToCandidate(id: string, context: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || mention.status !== 'candidate') return false
    const updated: OverheardEntry = { ...mention, userContext: context }
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    return true
  } catch {
    return false
  }
}

export async function confirmCandidate(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || mention.status !== 'candidate') return false
    const now = new Date().toISOString()
    const updated: OverheardEntry = {
      ...mention,
      kind: 'single',
      status: 'pending',
      writeup: '',
      confirmedAt: now,
    }
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    await redis.srem(CANDIDATE_SET_KEY, id)
    await redis.sadd(PENDING_SET_KEY, id)
    await populatePendingWriteup(id)
    return true
  } catch {
    return false
  }
}

export async function groupCandidatesIntoThread(ids: string[]): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (ids.length < 2) return { ok: false, error: 'Select at least 2 candidates' }

  try {
    const redis = getRedis()
    const entries = (
      await Promise.all(ids.map(id => redis.get(mentionKey(id)).then(normalizeOverheardEntry)))
    ).filter((e): e is OverheardEntry => Boolean(e))

    if (entries.length !== ids.length) return { ok: false, error: 'One or more candidates not found' }
    if (entries.some(e => e.status !== 'candidate')) return { ok: false, error: 'All selected items must be candidates' }

    const repoSlug = entries[0]!.repoSlug
    const episodeSlug = entries[0]!.episodeSlug
    if (entries.some(e => e.repoSlug !== repoSlug) || entries.some(e => e.episodeSlug !== episodeSlug)) {
      return { ok: false, error: 'Threads must be same repo and same episode' }
    }

    const quotes: OverheardQuote[] = entries
      .flatMap(e => e.quotes)
      .sort((a, b) => a.approxTimestampSec - b.approxTimestampSec)

    const userContext = entries.map(e => e.userContext?.trim()).filter(Boolean).join('\n\n') || null
    const threadId = randomUUID()
    const draft: OverheardEntry = {
      id: threadId,
      kind: 'thread',
      repoSlug,
      episodeName: entries[0]!.episodeName,
      episodeSlug: entries[0]!.episodeSlug,
      episodeUrl: entries[0]!.episodeUrl,
      episodePublishedAt: entries[0]!.episodePublishedAt,
      quotes,
      writeup: '',
      status: 'pending',
      userContext,
      scannedAt: entries.map(e => e.scannedAt).filter(Boolean).sort()[0] ?? new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      publishedAt: null,
    }

    await redis.set(mentionKey(threadId), draft, { ex: 60 * 60 * 24 * 365 })
    await redis.sadd(PENDING_SET_KEY, threadId)

    for (const id of ids) {
      await redis.srem(CANDIDATE_SET_KEY, id)
      await redis.del(mentionKey(id))
    }

    await populatePendingWriteup(threadId)

    return { ok: true, id: threadId }
  } catch {
    return { ok: false, error: 'Failed to group thread' }
  }
}

export async function regeneratePendingWriteup(id: string): Promise<string | null> {
  try {
    const redis = getRedis()
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || mention.status !== 'pending') return null
    const generated = await generateOverheardWriteup(mention)
    if (!generated.writeup) return null
    const updated: OverheardEntry = {
      ...mention,
      writeup: generated.writeup,
      ...(generated.writeupNormie ? { writeupNormie: generated.writeupNormie } : {}),
      confirmedAt: mention.confirmedAt ?? new Date().toISOString(),
    }
    if (!generated.writeupNormie) delete updated.writeupNormie
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    return generated.writeup
  } catch {
    return null
  }
}

export type MentionEditPayload = {
  writeup?: string
  writeupNormie?: string | null
  quotes?: OverheardQuote[]
  userContext?: string | null
  repoSlug?: string
}

export async function updateMentionEntry(id: string, payload: MentionEditPayload): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || (mention.status !== 'pending' && mention.status !== 'published')) return false

    const quotes = payload.quotes ?? mention.quotes
    const writeupChanged =
      payload.writeup !== undefined && payload.writeup.trim() !== mention.writeup
    const updated: OverheardEntry = {
      ...mention,
      writeup: payload.writeup !== undefined ? payload.writeup.trim() : mention.writeup,
      quotes,
      userContext:
        payload.userContext !== undefined
          ? (payload.userContext?.trim() || null)
          : mention.userContext,
      repoSlug: payload.repoSlug?.trim() || mention.repoSlug,
      kind: quotes.length > 1 ? 'thread' : 'single',
    }
    if (payload.writeupNormie !== undefined) {
      if (payload.writeupNormie?.trim()) updated.writeupNormie = payload.writeupNormie.trim()
      else delete updated.writeupNormie
    } else if (writeupChanged) {
      // Manual edit of standard writeup invalidates the paired normie copy.
      delete updated.writeupNormie
    }
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    if (mention.status === 'published') await invalidateOverheardPublicCache()
    return true
  } catch {
    return false
  }
}

export async function updatePendingWriteup(id: string, writeup: string): Promise<boolean> {
  return updateMentionEntry(id, { writeup })
}

async function invalidateOverheardPublicCache(): Promise<void> {
  const { generateAndCacheOverheard } = await import('@/lib/overheard')
  await generateAndCacheOverheard().catch(() => null)
}

/** Remove from homepage only — keep in archives. */
export async function takeDownMention(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || mention.status !== 'published') return false
    const updated: OverheardEntry = { ...mention, status: 'archived' }
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    await invalidateOverheardPublicCache()
    return true
  } catch {
    return false
  }
}

/** Remove from homepage and archives. */
export async function removeMentionFromArchives(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || (mention.status !== 'published' && mention.status !== 'archived')) return false
    const updated: OverheardEntry = { ...mention, status: 'taken_down' }
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    await redis.srem(PUBLISHED_SET_KEY, id)
    await invalidateOverheardPublicCache()
    return true
  } catch {
    return false
  }
}

export async function movePublishedToPending(id: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || (mention.status !== 'published' && mention.status !== 'archived')) return false
    const updated: OverheardEntry = { ...mention, status: 'pending' }
    await redis.set(mentionKey(id), updated, { ex: 60 * 60 * 24 * 365 })
    await redis.srem(PUBLISHED_SET_KEY, id)
    await redis.sadd(PENDING_SET_KEY, id)
    await invalidateOverheardPublicCache()
    return true
  } catch {
    return false
  }
}

export async function publishMention(id: string, writeup?: string): Promise<boolean> {
  try {
    const redis = getRedis()
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || mention.status !== 'pending') return false

    let nextWriteup = typeof writeup === 'string' && writeup.trim() ? writeup.trim() : mention.writeup.trim()
    let nextNormie = mention.writeupNormie
    if (!nextWriteup) {
      const generated = await generateOverheardWriteup(mention)
      nextWriteup = generated.writeup
      nextNormie = generated.writeupNormie
    } else if (nextWriteup !== mention.writeup) {
      // Admin overrode the writeup at publish — drop stale normie copy.
      nextNormie = undefined
    }

    const updated: OverheardEntry = {
      ...mention,
      writeup: nextWriteup,
      ...(nextNormie ? { writeupNormie: nextNormie } : {}),
      status: 'published',
      publishedAt: new Date().toISOString(),
    }
    if (!nextNormie) delete updated.writeupNormie
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
    const mention = normalizeOverheardEntry(await redis.get(mentionKey(id)))
    if (!mention || mention.status !== 'pending' || mention.publishedAt) return false
    await redis.srem(PENDING_SET_KEY, id)
    await redis.srem(CANDIDATE_SET_KEY, id)
    await redis.del(mentionKey(id))
    return true
  } catch {
    return false
  }
}

export async function getPublishedMentions(): Promise<OverheardEntry[]> {
  const entries = await getMentionsFromSet(PUBLISHED_SET_KEY)
  return entries
    .filter(e => e.status === 'published')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

/** Live + archived (home take-down) entries for admin lists. */
export async function getArchiveVisibleMentions(): Promise<OverheardEntry[]> {
  const entries = await getMentionsFromSet(PUBLISHED_SET_KEY)
  return entries
    .filter(e => e.status === 'published' || e.status === 'archived')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

/** Archive feed: published + archived Overheard with publishedAt >= sinceIso. */
export async function listPublishedMentionsSince(sinceIso: string): Promise<OverheardEntry[]> {
  const sinceMs = Date.parse(sinceIso)
  const all = await getArchiveVisibleMentions()
  return all.filter(m => m.publishedAt && Date.parse(m.publishedAt) >= sinceMs)
}

export async function getLatestPublishedMention(): Promise<OverheardEntry | null> {
  const published = await getPublishedMentions()
  return published[0] ?? null
}
