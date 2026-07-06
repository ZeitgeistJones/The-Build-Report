import Anthropic from '@anthropic-ai/sdk'
import { getRedis } from '@/lib/redis'
import { getEffectiveTag } from '@/lib/economicGrade'
import { hasShippingLeverageTag } from '@/lib/rubrics/shippingLeverage'
import { getCachedAutoScoresForSlugs } from '@/lib/autoscore'
import { mergeRepoSources, cacheLookupSlugs } from '@/lib/repoOrder'
import { applyExcludedToRepos, filterPublicRepos, getExcludedSlugs } from '@/lib/repoExclude'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { REPOS, type Repo } from '@/lib/scores'
import type { GitHubStats } from '@/lib/github'
import { stripMarkdown } from '@/lib/textCleanup'
import {
  calcBuilderGrade,
  calcIntegrityGrade,
  calcTokenMechanicGrade,
  type Period,
} from '@/lib/grades'
import {
  builderCardLayman,
  economicCardLayman,
  integrityCardLayman,
} from '@/lib/gradeCardCopy'

const DIGEST_KEY_PREFIX = 'build-report:daily-digest:'
const BRIEF_KEY_PREFIX = 'build-report:build-brief:'
const DIGEST_TTL_SEC = 72 * 3600
const EASTERN_TZ = 'America/New_York'

export interface RepoBuildActivity {
  slug: string
  tag: string
  commits: string[]
}

export interface CardBlurbs {
  builder: string
  economic: string
  integrity: string
}

export interface DailyDigestCards {
  '7d': CardBlurbs
  '30d': CardBlurbs
  '60d': CardBlurbs
}

export interface DailyDigestCache {
  general: string
  cards: DailyDigestCards
  dateKey: string
  repoCount: number
  commitCount: number
  generatedAt: string
}

export interface BuildBriefData {
  text: string
  general: string
  cards: DailyDigestCards | null
  dateKey: string
  isToday: boolean
  repoCount: number
  commitCount: number
  generatedAt: string | null
}

export function dateKeyEastern(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: EASTERN_TZ }).format(d)
}

/** Eastern calendar date for the day before `now` (the day we summarize for morning visitors). */
export function yesterdayEasternDateKey(now = new Date()): string {
  const todayKey = dateKeyEastern(now)
  let probe = new Date(now.getTime() - 25 * 3600000)
  let key = dateKeyEastern(probe)
  if (key >= todayKey) {
    probe = new Date(probe.getTime() - 24 * 3600000)
    key = dateKeyEastern(probe)
  }
  return key
}

function digestRedisKey(dateKey: string): string {
  return `${DIGEST_KEY_PREFIX}${dateKey}`
}

function briefRedisKey(dateKey: string): string {
  return `${BRIEF_KEY_PREFIX}${dateKey}`
}

function commitOnEasternDate(isoDate: string, easternDateKey: string): boolean {
  return dateKeyEastern(new Date(isoDate)) === easternDateKey
}

export function collectBuildActivityForEasternDay(
  stats: GitHubStats,
  repos: Repo[],
  easternDateKey: string,
): RepoBuildActivity[] {
  const tagBySlug = new Map(repos.map(r => [r.githubSlug, getEffectiveTag(r)]))
  const out: RepoBuildActivity[] = []

  for (const [slug, activity] of Object.entries(stats.repoActivity)) {
    const recent =
      activity.recentCommits?.filter(c => commitOnEasternDate(c.date, easternDateKey)) ?? []
    if (!recent.length) continue
    out.push({
      slug,
      tag: tagBySlug.get(slug) ?? 'theoretical',
      commits: recent.map(c => c.message),
    })
  }

  return out.sort((a, b) => b.commits.length - a.commits.length)
}

function formatActivityForPrompt(activity: RepoBuildActivity[], dayLabel: string): string {
  if (!activity.length) return `No commits in scanned repos on ${dayLabel}.`

  return activity
    .map(row => {
      const kind = hasShippingLeverageTag(row.tag as Repo['tag']) ? 'leverage' : 'burn-app'
      const msgs = row.commits.slice(0, 8).map(m => `  - ${m}`).join('\n')
      const extra = row.commits.length > 8 ? `\n  - …and ${row.commits.length - 8} more` : ''
      return `${row.slug} (${row.tag}, ${kind}):\n${msgs}${extra}`
    })
    .join('\n\n')
}

function formatGradeContext(stats: GitHubStats, repos: Repo[]): string {
  const periods: Period[] = ['7d', '30d', '60d']
  return periods
    .map(period => {
      const bg = calcBuilderGrade(stats, period)
      const tg = calcTokenMechanicGrade(stats, period, repos)
      const ig = calcIntegrityGrade(stats, period, repos)
      const trend =
        period === '60d'
          ? 'no prior-window trend'
          : `trend ${bg.trend}${bg.trendPct != null ? ` (${bg.trendPct > 0 ? '+' : ''}${bg.trendPct}% vs prior)` : ''}`
      return [
        `${period} window:`,
        `  Builder activity: ${bg.letter} (${bg.pct}%), ${trend}`,
        `  Burn apps (economic): ${tg.letter} (${tg.pct}%), ${tg.counts.repos} repos in sample`,
        `  Builder integrity: ${ig.letter} (${ig.pct}%), ${ig.counts.commitWeight} commits weighted (${ig.counts.low} low / ${ig.counts.mid} mid / ${ig.counts.high} high)`,
      ].join('\n')
    })
    .join('\n\n')
}

const QUIET_GENERAL =
  'It was a quiet day across the sampled repos — no commits landed on the actively tracked GitHub projects. The grades above still reflect longer windows of activity and scoring. Check back tomorrow for a fresher picture of what shipped.'

function buildFallbackDigest(
  stats: GitHubStats,
  repos: Repo[],
  activity: RepoBuildActivity[],
  easternDateKey: string,
): Omit<DailyDigestCache, 'generatedAt'> {
  const periods: Period[] = ['7d', '30d', '60d']
  const cards = {} as DailyDigestCards

  for (const period of periods) {
    const bg = calcBuilderGrade(stats, period)
    const tg = calcTokenMechanicGrade(stats, period, repos)
    const ig = calcIntegrityGrade(stats, period, repos)
    cards[period] = {
      builder: builderCardLayman(bg, period),
      economic: economicCardLayman(tg, period),
      integrity: integrityCardLayman(ig, period),
    }
  }

  let general = QUIET_GENERAL
  if (activity.length) {
    const names = activity
      .slice(0, 5)
      .map(a => `${a.slug} (${a.commits.length} commit${a.commits.length === 1 ? '' : 's'})`)
      .join(', ')
    const extra = activity.length > 5 ? ` and ${activity.length - 5} more repos` : ''
    general = `On ${easternDateKey}, work landed on ${names}${extra}. `
    const burnCount = activity.filter(a => !hasShippingLeverageTag(a.tag as Repo['tag'])).length
    const leverageCount = activity.length - burnCount
    if (burnCount && leverageCount) {
      general += `${burnCount} burn-app repo${burnCount === 1 ? '' : 's'} and ${leverageCount} infra/leverage repo${leverageCount === 1 ? '' : 's'} saw commits. `
    }
    general +=
      'The grade cards below put that activity in context across the 7-day, 30-day, and 60-day windows.'
  }

  return {
    general,
    cards,
    dateKey: easternDateKey,
    repoCount: activity.length,
    commitCount: activity.reduce((n, a) => n + a.commits.length, 0),
  }
}

interface DigestAiPayload {
  general: string
  cards: DailyDigestCards
}

function parseDigestJson(raw: string): DigestAiPayload | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as DigestAiPayload
    if (!parsed.general || !parsed.cards) return null
    for (const period of ['7d', '30d', '60d'] as const) {
      const row = parsed.cards[period]
      if (!row?.builder || !row.economic || !row.integrity) return null
    }
    return parsed
  } catch {
    return null
  }
}

async function generateDigestWithAi(
  activity: RepoBuildActivity[],
  gradeContext: string,
  easternDateKey: string,
): Promise<DigestAiPayload | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You write copy for The Build Report — an independent dashboard that tracks clawdbotatg's GitHub repos for $CLAWD holders.

Summarize ${easternDateKey} (America/New_York calendar day).

COMMITS THAT DAY (sampled active repos only — do not invent repos or work):
${formatActivityForPrompt(activity, easternDateKey)}

CURRENT GRADES (use for context; card copy should match the period label):
${gradeContext}

Return ONLY valid JSON, no markdown fences:
{
  "general": "3-4 sentences. Plain English morning overview of what shipped yesterday. Warm, clear, a little personality — like a sharp friend explaining the day. Not degen, not hype, no crypto slang. Mention specific repos only if listed above.",
  "cards": {
    "7d": {
      "builder": "Exactly 2 sentences about builder activity for the 7-day window.",
      "economic": "Exactly 2 sentences about burn-app economics for the 7-day window.",
      "integrity": "Exactly 2 sentences about builder integrity/trust for the 7-day window."
    },
    "30d": { "builder": "...", "economic": "...", "integrity": "..." },
    "60d": { "builder": "...", "economic": "...", "integrity": "..." }
  }
}

Rules:
- Each card field: exactly 2 complete sentences.
- general: exactly 3-4 complete sentences, meatier than any single card.
- Reference letter grades or trends only when helpful; never fabricate numbers.
- Say "burn apps" not "token mechanics" in economic copy.
- Integrity copy = trust, transparency, safety — not moralizing.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1100,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!text) return null
    const parsed = parseDigestJson(text)
    if (!parsed) return null
    return {
      general: stripMarkdown(parsed.general),
      cards: {
        '7d': {
          builder: stripMarkdown(parsed.cards['7d'].builder),
          economic: stripMarkdown(parsed.cards['7d'].economic),
          integrity: stripMarkdown(parsed.cards['7d'].integrity),
        },
        '30d': {
          builder: stripMarkdown(parsed.cards['30d'].builder),
          economic: stripMarkdown(parsed.cards['30d'].economic),
          integrity: stripMarkdown(parsed.cards['30d'].integrity),
        },
        '60d': {
          builder: stripMarkdown(parsed.cards['60d'].builder),
          economic: stripMarkdown(parsed.cards['60d'].economic),
          integrity: stripMarkdown(parsed.cards['60d'].integrity),
        },
      },
    }
  } catch {
    return null
  }
}

export async function loadReposForBrief(stats: GitHubStats): Promise<Repo[]> {
  const excludedMap = await getExcludedSlugs()
  const excludedSlugs = new Set(Object.keys(excludedMap).filter(k => excludedMap[k]))
  const cacheSlugs = cacheLookupSlugs(REPOS, stats.trackableRepos, excludedSlugs)
  const autoScoredRaw = cacheSlugs.length > 0 ? await getCachedAutoScoresForSlugs(cacheSlugs) : []
  const autoScored = autoScoredRaw.filter(r => !shouldSkipRepo(r.githubSlug))
  return filterPublicRepos(applyExcludedToRepos(mergeRepoSources(REPOS, autoScored), excludedMap))
}

export async function cacheDailyDigest(dateKey: string, payload: DailyDigestCache): Promise<void> {
  try {
    const r = getRedis()
    await r.set(digestRedisKey(dateKey), JSON.stringify(payload), { ex: DIGEST_TTL_SEC })
  } catch {
    // non-fatal
  }
}

export async function generateAndCacheDailyDigest(
  stats: GitHubStats,
  repos: Repo[],
  easternDateKey = yesterdayEasternDateKey(),
): Promise<DailyDigestCache> {
  const activity = collectBuildActivityForEasternDay(stats, repos, easternDateKey)
  const commitCount = activity.reduce((n, a) => n + a.commits.length, 0)
  const gradeContext = formatGradeContext(stats, repos)

  const ai = await generateDigestWithAi(activity, gradeContext, easternDateKey)
  const fallback = buildFallbackDigest(stats, repos, activity, easternDateKey)

  const payload: DailyDigestCache = {
    general: ai?.general ?? fallback.general,
    cards: ai?.cards ?? fallback.cards,
    dateKey: easternDateKey,
    repoCount: activity.length,
    commitCount,
    generatedAt: new Date().toISOString(),
  }

  await cacheDailyDigest(easternDateKey, payload)
  return payload
}

export async function generateAndCacheBuildBrief(
  stats: GitHubStats,
  repos: Repo[],
): Promise<{ text: string; repoCount: number; commitCount: number; generatedAt: string }> {
  const digest = await generateAndCacheDailyDigest(stats, repos)
  return {
    text: digest.general,
    repoCount: digest.repoCount,
    commitCount: digest.commitCount,
    generatedAt: digest.generatedAt,
  }
}

async function readCachedDigest(dateKey: string): Promise<DailyDigestCache | null> {
  try {
    const r = getRedis()
    const raw = await r.get<string>(digestRedisKey(dateKey))
    if (!raw) return null
    if (typeof raw === 'string') return JSON.parse(raw) as DailyDigestCache
    return raw as DailyDigestCache
  } catch {
    return null
  }
}

async function readLegacyBrief(
  dateKey: string,
): Promise<{ text: string; repoCount: number; commitCount: number; generatedAt: string } | null> {
  try {
    const r = getRedis()
    const raw = await r.get<string>(briefRedisKey(dateKey))
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed as { text: string; repoCount: number; commitCount: number; generatedAt: string }
  } catch {
    return null
  }
}

function toBuildBriefData(digest: DailyDigestCache): BuildBriefData {
  return {
    text: digest.general,
    general: digest.general,
    cards: digest.cards,
    dateKey: digest.dateKey,
    isToday: false,
    repoCount: digest.repoCount,
    commitCount: digest.commitCount,
    generatedAt: digest.generatedAt,
  }
}

export async function getBuildBrief(): Promise<BuildBriefData | null> {
  const targetKey = yesterdayEasternDateKey()
  const digest = await readCachedDigest(targetKey)
  if (digest) return toBuildBriefData(digest)

  const priorKey = yesterdayEasternDateKey(new Date(Date.now() - 86400000))
  const priorDigest = await readCachedDigest(priorKey)
  if (priorDigest) return toBuildBriefData(priorDigest)

  const legacy = await readLegacyBrief(targetKey)
  if (legacy) {
    return {
      text: legacy.text,
      general: legacy.text,
      cards: null,
      dateKey: targetKey,
      isToday: false,
      repoCount: legacy.repoCount,
      commitCount: legacy.commitCount,
      generatedAt: legacy.generatedAt,
    }
  }

  return null
}

export function cardCopyForPeriod(
  brief: BuildBriefData | null,
  period: Period,
  card: keyof CardBlurbs,
): string | null {
  return brief?.cards?.[period]?.[card] ?? null
}
