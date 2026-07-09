import { getRedis } from '@/lib/redis'
import { getPublishedMentions, type OverheardEntry } from '@/lib/podcastMentions'
import { REPOS } from '@/lib/scores'

const OVERHEARD_DIGEST_KEY_PREFIX = 'build-report:overheard-digest:'
const OVERHEARD_TTL_SEC = 72 * 3600
const EASTERN_TZ = 'America/New_York'

export interface OverheardDigest {
  alsoDiscussed: string | null
  mentionCount: number
  dateKey: string
  generatedAt: string
}

function dateKeyEastern(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: EASTERN_TZ }).format(d)
}

function overheardDigestRedisKey(dateKey: string): string {
  return `${OVERHEARD_DIGEST_KEY_PREFIX}${dateKey}`
}

function displayRepoName(slug: string): string {
  return REPOS.find(r => r.githubSlug === slug)?.name ?? slug
}

async function getMentionsPublishedLast24h(): Promise<OverheardEntry[]> {
  const all = await getPublishedMentions()
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  return all.filter(m => m.publishedAt && Date.parse(m.publishedAt) >= cutoff)
}

function buildDigestFromPublished(published: OverheardEntry[]): OverheardDigest | null {
  if (!published.length) return null
  const featured = published[0]!
  const others = published.filter(e => e.id !== featured.id)
  const repoSlugs = [...new Set(others.map(e => e.repoSlug))]
  return {
    alsoDiscussed: repoSlugs.length
      ? `Also discussed today: ${repoSlugs.map(displayRepoName).join(', ')}`
      : null,
    mentionCount: published.length,
    dateKey: dateKeyEastern(),
    generatedAt: new Date().toISOString(),
  }
}

export async function getFeaturedOverheardEntry(): Promise<OverheardEntry | null> {
  const published = await getMentionsPublishedLast24h()
  return published[0] ?? null
}

export async function getOverheardDigest(): Promise<OverheardDigest | null> {
  try {
    const redis = getRedis()
    const dateKey = dateKeyEastern()
    const cached = await redis.get<OverheardDigest>(overheardDigestRedisKey(dateKey))
    if (cached) return cached
  } catch {
    // fall through to live build
  }
  const published = await getMentionsPublishedLast24h()
  return buildDigestFromPublished(published)
}

/** Refresh cached digest footer after publish (cron-compatible). */
export async function generateAndCacheOverheard(): Promise<OverheardDigest | null> {
  const redis = getRedis()
  const published = await getMentionsPublishedLast24h()
  const digest = buildDigestFromPublished(published)
  if (!digest) return null
  await redis.set(overheardDigestRedisKey(digest.dateKey), digest, { ex: OVERHEARD_TTL_SEC })
  return digest
}
