/**
 * Yesterday's Build for gitlawb / $GITLAWB — overview-only digest (no grade cards).
 * Admin + daily cron; separate Redis keys from clawdbotatg digests.
 */

import { getRedis } from '@/lib/redis'
import { generateText, hasLlmApiKey } from '@/lib/llm'
import { stripMarkdown } from '@/lib/textCleanup'
import { NORMIE_TEMPERATURE, normieVoiceGuidance } from '@/lib/normieVoice'
import {
  type BuildBriefData,
  yesterdayMountainDateKey,
} from '@/lib/buildBrief'
import {
  fetchGitlawbDayActivity,
  type GitlawbDayActivity,
  type GitlawbDaySnapshot,
  GITLAWB_OWNER,
} from '@/lib/gitlawbGithub'

const DIGEST_KEY_PREFIX = 'build-report:gitlawb-digest:'
const DIGEST_TTL_SEC = 90 * 24 * 3600

export type GitlawbDigestCache = {
  general: string
  generalNormie?: string
  dateKey: string
  repoCount: number
  commitCount: number
  generatedAt: string
  owner: string
}

function digestRedisKey(dateKey: string): string {
  return `${DIGEST_KEY_PREFIX}${dateKey}`
}

function formatActivityForPrompt(activity: GitlawbDayActivity[], dayLabel: string): string {
  if (!activity.length) return `No commits on ${GITLAWB_OWNER} repos on ${dayLabel}.`

  return activity
    .map(row => {
      const desc = row.description ? ` — ${row.description.slice(0, 120)}` : ''
      const msgs = row.commits.slice(0, 10).map(c => `  - ${c.message}`).join('\n')
      const extra = row.commits.length > 10 ? `\n  - …and ${row.commits.length - 10} more` : ''
      return `${row.slug}${desc}:\n${msgs}${extra}`
    })
    .join('\n\n')
}

function buildFallbackGeneral(snapshot: GitlawbDaySnapshot): string {
  if (!snapshot.activity.length) {
    return `Quiet day on github.com/${GITLAWB_OWNER} — no commits landed on the scanned public repos for ${snapshot.dateKey}. Check back tomorrow for a fresher read on what shipped for $GITLAWB.`
  }
  const names = snapshot.activity
    .slice(0, 5)
    .map(a => `${a.slug} (${a.commits.length} commit${a.commits.length === 1 ? '' : 's'})`)
    .join(', ')
  const extra =
    snapshot.activity.length > 5 ? ` and ${snapshot.activity.length - 5} more repos` : ''
  return `On ${snapshot.dateKey}, work landed on ${names}${extra} under github.com/${GITLAWB_OWNER}. This is a shipping summary for the $GITLAWB builder account — not a scored Build Report grade card.`
}

async function generateOverviewWithAi(
  snapshot: GitlawbDaySnapshot,
): Promise<{ general: string; generalNormie?: string } | null> {
  if (!hasLlmApiKey()) return null

  const activityBlock = formatActivityForPrompt(snapshot.activity, snapshot.dateKey)
  const prompt = `You write Yesterday's Build for The Build Report — a short shipping summary for a SECOND GitHub account (not clawdbotatg / CLAWD).

Account: github.com/${GITLAWB_OWNER}
Token ticker (when relevant): $GITLAWB — always write it exactly as $GITLAWB (uppercase).
Edition date (Mountain / America/Denver calendar): ${snapshot.dateKey}
Repos with commits that day: ${snapshot.repoCount}
Commits that day: ${snapshot.commitCount}

COMMITS:
${activityBlock}

Write JSON only:
{"general":"…","generalNormie":"…"}

Rules:
- general: 2–4 short paragraphs (or fewer if quiet). Technical but readable. Name real repos that shipped. Ground claims in the commit list — do not invent features, burns, locks, or tokenomics.
- generalNormie: same facts in plain English for non-builders. ${normieVoiceGuidance('digestGeneral')}
- Mention $GITLAWB only when commits/descriptions clearly touch the token, holders, or related product; otherwise focus on what shipped.
- Never invent CLAWD framing, burn grades, or holder-economics scorecards — this account has no scores on The Build Report.
- If quiet (no commits), say so plainly and stop.
- No markdown, no bullet lists, no JSON inside the strings.`

  try {
    const { text, provider } = await generateText({
      prompt,
      maxTokens: 2048,
      temperature: NORMIE_TEMPERATURE,
      label: 'gitlawb-brief',
    })
    if (!text) {
      console.error('[gitlawb-brief] empty LLM response', { provider })
      return null
    }
    const trimmed = text.trim()
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      general?: unknown
      generalNormie?: unknown
    }
    const general = typeof parsed.general === 'string' ? stripMarkdown(parsed.general.trim()) : ''
    if (!general) return null
    const generalNormie =
      typeof parsed.generalNormie === 'string' && parsed.generalNormie.trim()
        ? stripMarkdown(parsed.generalNormie.trim())
        : undefined
    return { general, ...(generalNormie ? { generalNormie } : {}) }
  } catch (err) {
    console.error('[gitlawb-brief] AI generation failed:', err)
    return null
  }
}

async function readCachedDigest(dateKey: string): Promise<GitlawbDigestCache | null> {
  try {
    const r = getRedis()
    const raw = await r.get<string>(digestRedisKey(dateKey))
    if (!raw) return null
    if (typeof raw === 'string') return JSON.parse(raw) as GitlawbDigestCache
    return raw as GitlawbDigestCache
  } catch {
    return null
  }
}

async function cacheDigest(payload: GitlawbDigestCache): Promise<void> {
  try {
    const r = getRedis()
    await r.set(digestRedisKey(payload.dateKey), JSON.stringify(payload), { ex: DIGEST_TTL_SEC })
  } catch {
    // non-fatal
  }
}

function toBriefData(digest: GitlawbDigestCache): BuildBriefData {
  return {
    text: digest.general,
    general: digest.general,
    ...(digest.generalNormie ? { generalNormie: digest.generalNormie } : {}),
    cards: null,
    dateKey: digest.dateKey,
    isToday: false,
    repoCount: digest.repoCount,
    commitCount: digest.commitCount,
    generatedAt: digest.generatedAt,
  }
}

export async function generateAndCacheGitlawbDigest(options?: {
  force?: boolean
  dateKey?: string
}): Promise<GitlawbDigestCache> {
  const dateKey = options?.dateKey ?? yesterdayMountainDateKey()
  if (!options?.force) {
    const existing = await readCachedDigest(dateKey)
    if (existing?.general?.trim()) return existing
  }

  const snapshot = await fetchGitlawbDayActivity(dateKey)
  if (snapshot.rateLimited && snapshot.activity.length === 0) {
    console.warn('[gitlawb-brief] rate limited with no activity; writing quiet fallback', { dateKey })
  }

  const ai = await generateOverviewWithAi(snapshot)
  if (!ai) {
    console.warn('[gitlawb-brief] using template fallback', {
      dateKey,
      repoCount: snapshot.repoCount,
      commitCount: snapshot.commitCount,
    })
  }

  const payload: GitlawbDigestCache = {
    general: ai?.general ?? buildFallbackGeneral(snapshot),
    ...(ai?.generalNormie ? { generalNormie: ai.generalNormie } : {}),
    dateKey,
    repoCount: snapshot.repoCount,
    commitCount: snapshot.commitCount,
    generatedAt: new Date().toISOString(),
    owner: GITLAWB_OWNER,
  }

  await cacheDigest(payload)
  return payload
}

/** Cached brief for Admin UI (null if never generated). */
export async function getGitlawbBrief(
  dateKey = yesterdayMountainDateKey(),
): Promise<BuildBriefData | null> {
  const digest = await readCachedDigest(dateKey)
  if (!digest?.general?.trim()) return null
  return toBriefData(digest)
}

export async function getOrGenerateGitlawbBrief(options?: {
  force?: boolean
  dateKey?: string
}): Promise<BuildBriefData> {
  const digest = await generateAndCacheGitlawbDigest(options)
  return toBriefData(digest)
}
