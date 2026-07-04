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

const BRIEF_KEY_PREFIX = 'build-report:build-brief:'
const BRIEF_TTL_SEC = 48 * 3600
const WINDOW_HOURS = 24

export interface RepoBuildActivity {
  slug: string
  tag: string
  commits: string[]
}

export interface BuildBriefData {
  text: string
  dateKey: string
  isToday: boolean
  repoCount: number
  commitCount: number
  generatedAt: string | null
}

function dateKeyUtc(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function briefRedisKey(dateKey: string): string {
  return `${BRIEF_KEY_PREFIX}${dateKey}`
}

function isWithinHours(dateStr: string, hours: number): boolean {
  const ms = Date.now() - new Date(dateStr).getTime()
  return ms >= 0 && ms <= hours * 3600000
}

export function collectBuildActivity(
  stats: GitHubStats,
  repos: Repo[],
  windowHours = WINDOW_HOURS,
): RepoBuildActivity[] {
  const tagBySlug = new Map(repos.map(r => [r.githubSlug, getEffectiveTag(r)]))
  const out: RepoBuildActivity[] = []

  for (const [slug, activity] of Object.entries(stats.repoActivity)) {
    const recent = activity.recentCommits?.filter(c => isWithinHours(c.date, windowHours)) ?? []
    if (!recent.length) continue
    out.push({
      slug,
      tag: tagBySlug.get(slug) ?? 'theoretical',
      commits: recent.map(c => c.message),
    })
  }

  return out.sort((a, b) => b.commits.length - a.commits.length)
}

function formatActivityForPrompt(activity: RepoBuildActivity[]): string {
  if (!activity.length) return 'No commits in scanned repos in the last 24 hours.'

  return activity
    .map(row => {
      const kind = hasShippingLeverageTag(row.tag as Repo['tag']) ? 'leverage' : 'burn-app'
      const msgs = row.commits.slice(0, 8).map(m => `  - ${m}`).join('\n')
      const extra = row.commits.length > 8 ? `\n  - …and ${row.commits.length - 8} more` : ''
      return `${row.slug} (${row.tag}, ${kind}):\n${msgs}${extra}`
    })
    .join('\n\n')
}

const QUIET_BRIEF =
  'Quiet day in the sampled repos — no commits in the last 24 hours among the ~40 actively scanned GitHub repos.'

async function generateBuildBriefText(activity: RepoBuildActivity[]): Promise<string> {
  if (!activity.length) return QUIET_BRIEF

  if (!process.env.ANTHROPIC_API_KEY) {
    const names = activity.slice(0, 5).map(a => `${a.slug} (${a.commits.length})`).join(', ')
    return `Activity in the last 24h (sampled repos): ${names}${activity.length > 5 ? ` and ${activity.length - 5} more.` : '.'}`
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You are summarizing what clawdbotatg worked on across GitHub repos for $CLAWD holders.

Commits in the last 24 hours (sampled active repos only):

${formatActivityForPrompt(activity)}

Write 3–5 sentences of plain English. Cover:
- Which repos moved and what kind of work (features, fixes, infra, UI)
- Split between burn-app repos (direct/supply-lock) vs shipping-leverage repos (indirect/infrastructure/theoretical) when relevant
- Do not invent repos or changes not listed above

Rules: no bullet points, no markdown, direct tone.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return text ? stripMarkdown(text) : QUIET_BRIEF
  } catch {
    const names = activity.slice(0, 6).map(a => a.slug).join(', ')
    return `Recent commits landed on ${names}${activity.length > 6 ? ` and ${activity.length - 6} other repos` : ''} in the last 24 hours (sampled scan).`
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

interface CachedBrief {
  text: string
  repoCount: number
  commitCount: number
  generatedAt: string
}

export async function cacheBuildBrief(
  dateKey: string,
  payload: CachedBrief,
): Promise<void> {
  try {
    const r = getRedis()
    await r.set(briefRedisKey(dateKey), JSON.stringify(payload), { ex: BRIEF_TTL_SEC })
  } catch {
    // non-fatal
  }
}

export async function generateAndCacheBuildBrief(
  stats: GitHubStats,
  repos: Repo[],
): Promise<CachedBrief> {
  const activity = collectBuildActivity(stats, repos)
  const commitCount = activity.reduce((n, a) => n + a.commits.length, 0)
  const text = await generateBuildBriefText(activity)
  const payload: CachedBrief = {
    text,
    repoCount: activity.length,
    commitCount,
    generatedAt: new Date().toISOString(),
  }
  await cacheBuildBrief(dateKeyUtc(), payload)
  return payload
}

async function readCachedBrief(dateKey: string): Promise<CachedBrief | null> {
  try {
    const r = getRedis()
    const raw = await r.get<string>(briefRedisKey(dateKey))
    if (!raw) return null
    if (typeof raw === 'string') return JSON.parse(raw) as CachedBrief
    return raw as CachedBrief
  } catch {
    return null
  }
}

export async function getBuildBrief(): Promise<BuildBriefData | null> {
  const today = dateKeyUtc()
  const todayCached = await readCachedBrief(today)
  if (todayCached) {
    return {
      text: todayCached.text,
      dateKey: today,
      isToday: true,
      repoCount: todayCached.repoCount,
      commitCount: todayCached.commitCount,
      generatedAt: todayCached.generatedAt,
    }
  }

  const yesterday = dateKeyUtc(new Date(Date.now() - 86400000))
  const yesterdayCached = await readCachedBrief(yesterday)
  if (yesterdayCached) {
    return {
      text: yesterdayCached.text,
      dateKey: yesterday,
      isToday: false,
      repoCount: yesterdayCached.repoCount,
      commitCount: yesterdayCached.commitCount,
      generatedAt: yesterdayCached.generatedAt,
    }
  }

  return null
}
