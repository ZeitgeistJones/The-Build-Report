/**
 * $CLAWD mentions — where and when $CLAWD / clawdbotatg / larv.ai came up outside
 * the builder's own repos. Free sources only: Farcaster, Bluesky, Hacker News,
 * GitHub (other people's repos), and slop.computer podcast transcripts.
 *
 * Mentions accumulate in one Redis hash with no TTL, so history survives past each
 * source's own search window. Collected by /api/cron/clawd-mentions once a day.
 */
import { getRedis } from '@/lib/redis'
import { fetchAllEpisodes, episodePublicUrl, fetchIpfsText } from '@/lib/web3/slopComputer'
import { extractTranscriptUri, fetchJsonFromIpfs, fetchTranscriptLines } from '@/lib/podcastMentions'

export type ClawdMentionSource = 'farcaster' | 'bluesky' | 'hackernews' | 'github' | 'podcast'

export interface ClawdMention {
  id: string
  source: ClawdMentionSource
  author: string
  text: string
  url: string
  /** ISO time the post / repo / episode line was published. */
  at: string
  /** Episode name, repo name, etc. */
  context?: string
}

export interface ClawdMentionCollectResult {
  added: Record<ClawdMentionSource, number>
  errors: string[]
  total: number
  podcastEpisodesScanned: number
  podcastEpisodesTotal: number
}

const MENTIONS_KEY = 'build-report:clawd-mentions'
const PODCAST_SCANNED_KEY = 'build-report:clawd-mentions:podcast-scanned'
const MAX_STORED = 3000
const MAX_TEXT = 400

/**
 * Plain "clawd" is ambiguous (OpenClaw's old bot name, a Monster High doll), so only
 * the cashtag and project-specific names count as a mention.
 */
const MENTION_RE = /\$clawd\b|clawdbotatg|larv\.ai|clawdviction/i
/**
 * slop.computer is clawdbotatg's own show, where bare "clawd" means the bot/token —
 * and speech-to-text never writes the "$", so the strict pattern would miss spoken mentions.
 */
const PODCAST_MENTION_RE = /\$clawd\b|\bclawd\b|clawdbotatg|larv\.ai|clawdviction/i
const SEARCH_TERMS = ['$CLAWD', 'clawdbotatg', 'larv.ai', 'clawdviction']
const UA = { 'User-Agent': 'TheBuildReport/1.0 (+https://the-build-report.vercel.app)' }

function clip(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1).trimEnd()}…` : t
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${res.status} ${url.split('?')[0]}`)
  return (await res.json()) as T
}

// ── Farcaster (Warpcast public search) ─────────────────────────────

interface WarpcastCast {
  hash: string
  text?: string
  timestamp: number
  author?: { username?: string; displayName?: string }
}

interface WarpcastSearch {
  result?: { casts?: WarpcastCast[] }
  next?: { cursor?: string }
}

async function collectFarcaster(maxPages: number): Promise<ClawdMention[]> {
  const out: ClawdMention[] = []
  for (const term of SEARCH_TERMS) {
    let cursor: string | undefined
    for (let page = 0; page < maxPages; page++) {
      const url = `https://api.warpcast.com/v2/search-casts?q=${encodeURIComponent(term)}&limit=100${cursor ? `&cursor=${cursor}` : ''}`
      const data = await fetchJson<WarpcastSearch>(url)
      const casts = data.result?.casts ?? []
      for (const c of casts) {
        const text = c.text ?? ''
        if (!c.hash || !MENTION_RE.test(text) || !Number.isFinite(c.timestamp)) continue
        const username = c.author?.username ?? 'unknown'
        out.push({
          id: `farcaster:${c.hash}`,
          source: 'farcaster',
          author: username,
          text: clip(text),
          url: `https://farcaster.xyz/${username}/${c.hash.slice(0, 10)}`,
          at: new Date(c.timestamp).toISOString(),
        })
      }
      cursor = data.next?.cursor
      if (!cursor || !casts.length) break
    }
  }
  return out
}

// ── Bluesky (public AppView search) ────────────────────────────────

interface BskyPost {
  uri: string
  author?: { handle?: string }
  record?: { text?: string; createdAt?: string }
}

async function collectBluesky(): Promise<ClawdMention[]> {
  const out: ClawdMention[] = []
  for (const term of SEARCH_TERMS) {
    const data = await fetchJson<{ posts?: BskyPost[] }>(
      `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(term)}&limit=100`,
    )
    for (const p of data.posts ?? []) {
      const text = p.record?.text ?? ''
      const at = p.record?.createdAt
      if (!p.uri || !at || !MENTION_RE.test(text)) continue
      const handle = p.author?.handle ?? 'unknown'
      const rkey = p.uri.split('/').pop() ?? ''
      out.push({
        id: `bluesky:${p.uri}`,
        source: 'bluesky',
        author: handle,
        text: clip(text),
        url: `https://bsky.app/profile/${handle}/post/${rkey}`,
        at: new Date(at).toISOString(),
      })
    }
  }
  return out
}

// ── Hacker News (Algolia) ──────────────────────────────────────────

interface HnHit {
  objectID: string
  created_at: string
  author?: string
  title?: string | null
  comment_text?: string | null
  story_text?: string | null
  url?: string | null
}

async function collectHackerNews(): Promise<ClawdMention[]> {
  const out: ClawdMention[] = []
  for (const term of SEARCH_TERMS) {
    const data = await fetchJson<{ hits?: HnHit[] }>(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(term)}&hitsPerPage=100`,
    )
    for (const h of data.hits ?? []) {
      const text = stripHtml([h.title, h.comment_text, h.story_text, h.url].filter(Boolean).join(' '))
      if (!MENTION_RE.test(text)) continue
      out.push({
        id: `hackernews:${h.objectID}`,
        source: 'hackernews',
        author: h.author ?? 'unknown',
        text: clip(text),
        url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        at: new Date(h.created_at).toISOString(),
      })
    }
  }
  return out
}

// ── GitHub (other people's repos) ──────────────────────────────────

interface GhRepo {
  full_name: string
  html_url: string
  description: string | null
  created_at: string
  owner?: { login?: string }
}

async function collectGitHub(): Promise<ClawdMention[]> {
  const token = process.env.GITHUB_TOKEN?.trim()
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  // No "$CLAWD" query: GitHub search drops the "$" and matches thousands of Claude "Clawd" mascot repos.
  const queries = [
    'clawdbotatg in:name,description,readme -user:clawdbotatg',
    '"larv.ai" in:readme,description -user:clawdbotatg',
    'clawdviction in:name,description,readme -user:clawdbotatg',
  ]
  const out: ClawdMention[] = []
  for (const q of queries) {
    const data = await fetchJson<{ items?: GhRepo[] }>(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&per_page=100`,
      headers,
    )
    for (const r of data.items ?? []) {
      if (!r.full_name) continue
      out.push({
        id: `github:${r.full_name.toLowerCase()}`,
        source: 'github',
        author: r.owner?.login ?? r.full_name.split('/')[0],
        text: clip(r.description || 'Repository referencing clawdbotatg / $CLAWD'),
        url: r.html_url,
        at: new Date(r.created_at).toISOString(),
        context: r.full_name,
      })
    }
  }
  return out
}

// ── slop.computer podcasts ─────────────────────────────────────────

const MAX_LINES_PER_EPISODE = 6
const podcastProgress = { scanned: 0, total: 0 }

interface EpisodeLine {
  ts: number
  address: string | null
  handle: string | null
  text: string
}

/** Live chat log (JSONL, same shape as the transcript). Skips system lines like music changes. */
async function fetchChatLines(chatCid: string): Promise<EpisodeLine[]> {
  const text = await fetchIpfsText(chatCid.startsWith('ipfs://') ? chatCid : `ipfs://${chatCid}`, 15_000)
  if (!text) return []
  const lines: EpisodeLine[] = []
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue
    try {
      const obj = JSON.parse(raw) as { ts?: unknown; address?: unknown; handle?: unknown; text?: unknown; kind?: unknown }
      if (obj.kind === 'system' || typeof obj.text !== 'string' || typeof obj.ts !== 'number') continue
      lines.push({
        ts: obj.ts,
        address: typeof obj.address === 'string' ? obj.address : null,
        handle: typeof obj.handle === 'string' ? obj.handle : null,
        text: obj.text,
      })
    } catch {
      // skip malformed line
    }
  }
  return lines
}

function chatCidFromManifest(manifest: Record<string, unknown>): string | null {
  const chat = manifest.chat
  if (typeof chat === 'string' && chat) return chat
  if (chat && typeof chat === 'object' && typeof (chat as { cid?: unknown }).cid === 'string') {
    return (chat as { cid: string }).cid
  }
  return null
}

function speakerLabel(l: EpisodeLine): string {
  if (l.handle) return l.handle
  if (l.address) return `${l.address.slice(0, 6)}…${l.address.slice(-4)}`
  return 'anon'
}

async function collectPodcasts(deadlineMs: number): Promise<ClawdMention[]> {
  const redis = getRedis()
  const episodes = await fetchAllEpisodes()
  const scanned = new Set((await redis.smembers<string[]>(PODCAST_SCANNED_KEY).catch(() => [])) ?? [])
  const out: ClawdMention[] = []
  podcastProgress.total = episodes.length
  podcastProgress.scanned = scanned.size

  for (const ep of episodes) {
    if (Date.now() > deadlineMs) break
    if (scanned.has(ep.id) || !ep.manifest) continue
    const manifest = await fetchJsonFromIpfs<Record<string, unknown>>(ep.manifest)
    if (!manifest) continue
    const transcriptUri = extractTranscriptUri(manifest)
    const chatCid = chatCidFromManifest(manifest)
    const [spoken, chat] = await Promise.all([
      transcriptUri ? fetchTranscriptLines(transcriptUri) : Promise.resolve([]),
      chatCid ? fetchChatLines(chatCid) : Promise.resolve([]),
    ])
    // Files not reachable yet — retry on a later run instead of marking it scanned.
    if (!spoken.length && !chat.length) continue

    const tagged: [EpisodeLine, 'said' | 'chat'][] = [
      ...spoken.map(l => [l, 'said'] as [EpisodeLine, 'said']),
      ...chat.map(l => [l, 'chat'] as [EpisodeLine, 'chat']),
    ]
    const hits = tagged.filter(([l]) => PODCAST_MENTION_RE.test(l.text)).slice(0, MAX_LINES_PER_EPISODE)
    for (const [l, kind] of hits) {
      out.push({
        id: `podcast:${ep.id}:${kind}:${l.ts}`,
        source: 'podcast',
        author: speakerLabel(l),
        text: clip(l.text),
        url: episodePublicUrl(ep.slug),
        at: new Date(Number.isFinite(l.ts) ? l.ts : Number(ep.datetime) * 1000).toISOString(),
        context: `${ep.name} · ${kind === 'said' ? 'said on air' : 'live chat'}`,
      })
    }
    await redis.sadd(PODCAST_SCANNED_KEY, ep.id)
    podcastProgress.scanned++
  }
  return out
}

// ── Store ──────────────────────────────────────────────────────────

export async function getClawdMentions(): Promise<ClawdMention[]> {
  try {
    const redis = getRedis()
    const all = await redis.hgetall<Record<string, ClawdMention>>(MENTIONS_KEY)
    if (!all) return []
    return Object.values(all)
      .filter((m): m is ClawdMention => Boolean(m && typeof m === 'object' && m.id && m.at && m.url))
      .sort((a, b) => b.at.localeCompare(a.at))
  } catch (err) {
    console.error('[clawd-mentions] read failed', err)
    return []
  }
}

async function pruneOldest(): Promise<void> {
  const redis = getRedis()
  const all = await getClawdMentions()
  if (all.length <= MAX_STORED) return
  const drop = all.slice(MAX_STORED).map(m => m.id)
  if (drop.length) await redis.hdel(MENTIONS_KEY, ...drop)
}

/** Run every source; one failing source never blocks the others. */
export async function collectClawdMentions(opts: { deadlineMs: number }): Promise<ClawdMentionCollectResult> {
  const redis = getRedis()
  const existingIds = new Set((await redis.hkeys(MENTIONS_KEY).catch(() => [])) ?? [])
  // First run walks deeper into Farcaster history; daily runs only need the newest pages.
  const farcasterPages = existingIds.size === 0 ? 10 : 2

  const added: Record<ClawdMentionSource, number> = {
    farcaster: 0,
    bluesky: 0,
    hackernews: 0,
    github: 0,
    podcast: 0,
  }
  const errors: string[] = []

  const runs: [ClawdMentionSource, () => Promise<ClawdMention[]>][] = [
    ['farcaster', () => collectFarcaster(farcasterPages)],
    ['bluesky', collectBluesky],
    ['hackernews', collectHackerNews],
    ['github', collectGitHub],
    ['podcast', () => collectPodcasts(opts.deadlineMs)],
  ]

  for (const [source, run] of runs) {
    try {
      const found = await run()
      // GitHub is a current list of repos, not a post stream — drop repos that no longer match.
      if (source === 'github') {
        const keep = new Set(found.map(m => m.id))
        const stale = [...existingIds].filter(id => id.startsWith('github:') && !keep.has(id))
        if (stale.length) {
          await redis.hdel(MENTIONS_KEY, ...stale)
          for (const id of stale) existingIds.delete(id)
        }
      }
      const fresh: Record<string, ClawdMention> = {}
      for (const m of found) {
        if (existingIds.has(m.id) || fresh[m.id]) continue
        fresh[m.id] = m
      }
      const count = Object.keys(fresh).length
      if (count) {
        await redis.hset(MENTIONS_KEY, fresh)
        for (const id of Object.keys(fresh)) existingIds.add(id)
      }
      added[source] = count
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[clawd-mentions] ${source} failed`, err)
      errors.push(`${source}: ${message}`)
    }
  }

  await pruneOldest().catch(err => console.error('[clawd-mentions] prune failed', err))
  return {
    added,
    errors,
    total: existingIds.size,
    podcastEpisodesScanned: podcastProgress.scanned,
    podcastEpisodesTotal: podcastProgress.total,
  }
}
