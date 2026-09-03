import {
  generateTextGeminiFirst,
  generateTextGeminiOnly,
  hasGeminiApiKey,
  hasLlmApiKey,
} from '@/lib/llm'
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
import { missingNamedRepos, NORMIE_TEMPERATURE, normieVoiceGuidance } from '@/lib/normieVoice'
import {
  preferPlainFromLabeled,
  preferStandardFromLabeled,
  splitStandardPlainLabeled,
} from '@/lib/labeledLlmPair'
import { BRIEF_DATES_INDEX_KEY, indexArchiveDate } from '@/lib/archiveIndex'
import {
  calcBuilderGrade,
  calcIntegrityGrade,
  calcShippingLeverageGrade,
  calcTokenMechanicGrade,
  type Period,
} from '@/lib/grades'
import {
  builderCardLayman,
  economicCardLayman,
  integrityCardLayman,
  shippingLeverageCardLayman,
  builderWindowStatsFromGitHub,
  topReposByCommits,
} from '@/lib/gradeCardCopy'
import { isConsumerEconomicScored } from '@/lib/economicGrade'

const DIGEST_KEY_PREFIX = 'build-report:daily-digest:'
const BRIEF_KEY_PREFIX = 'build-report:build-brief:'
const DIGEST_TTL_SEC = 90 * 24 * 3600
/** Edition calendar for Yesterday's Build + Needle (clawdbotatg / MDT–MST). */
export const EDITION_TZ = 'America/Denver'

export interface RepoBuildActivity {
  slug: string
  tag: string
  commits: string[]
}

export interface CardNormieBlurbs {
  builder: string
  economic: string
  integrity: string
  leverage?: string
}

export interface CardBlurbs {
  builder: string
  economic: string
  integrity: string
  /** Optional — older cached digests predate the Shipping leverage card; panel falls back to live copy. */
  leverage?: string
  /** Optional plain-English ("normie") versions; older cached digests omit these and the panel falls back. */
  normie?: CardNormieBlurbs
}

export interface DailyDigestCards {
  '24h': CardBlurbs
  '7d': CardBlurbs
  '30d': CardBlurbs
  '60d': CardBlurbs
}

export interface DailyDigestCache {
  general: string
  /** Optional plain-English ("normie") version of the overview; omitted on older cached digests. */
  generalNormie?: string
  cards: DailyDigestCards
  dateKey: string
  repoCount: number
  commitCount: number
  generatedAt: string
  /** 'ai' = model writeup. 'fallback' = template. Cron retries fallbacks so a failed night cannot stick. */
  source?: 'ai' | 'fallback'
  /** Generate-time Gemini error. Not stored in Redis. */
  geminiError?: string
}

export interface BuildBriefData {
  text: string
  general: string
  generalNormie?: string
  cards: DailyDigestCards | null
  dateKey: string
  isToday: boolean
  repoCount: number
  commitCount: number
  generatedAt: string | null
}

export function dateKeyMountain(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: EDITION_TZ }).format(d)
}

/** Mountain calendar date for the day before `now` (the day we summarize for morning visitors). */
export function yesterdayMountainDateKey(now = new Date()): string {
  const todayKey = dateKeyMountain(now)
  const [y, m, d] = todayKey.split('-').map(Number)
  if (!y || !m || !d) {
    return dateKeyMountain(new Date(now.getTime() - 24 * 3600000))
  }
  // Subtract one calendar day from the Mountain YYYY-MM-DD — do not use a fixed
  // hour offset (e.g. -25h), which skips yesterday in the first hours after midnight.
  const prior = new Date(Date.UTC(y, m - 1, d))
  prior.setUTCDate(prior.getUTCDate() - 1)
  return prior.toISOString().slice(0, 10)
}

/**
 * UTC ms range [startMs, endMs) for a Mountain calendar YYYY-MM-DD
 * (midnight → next midnight America/Denver).
 */
export function mountainDateKeyBoundsMs(dateKey: string): { startMs: number; endMs: number } {
  const anchor = Date.parse(`${dateKey}T12:00:00.000Z`)
  if (!Number.isFinite(anchor)) {
    const now = Date.now()
    return { startMs: now, endMs: now }
  }
  // Search ±18h around UTC noon of that calendar date for Mountain midnight boundaries.
  const lo = anchor - 18 * 3600000
  const hi = anchor + 18 * 3600000
  let startMs = lo
  for (let t = lo; t <= hi; t += 60000) {
    if (dateKeyMountain(new Date(t)) === dateKey) {
      startMs = t
      break
    }
  }
  while (startMs > lo && dateKeyMountain(new Date(startMs - 1000)) === dateKey) {
    startMs -= 1000
  }
  let endMs = startMs + 24 * 3600000
  for (let t = startMs + 3600000; t <= hi + 24 * 3600000; t += 60000) {
    if (dateKeyMountain(new Date(t)) !== dateKey) {
      endMs = t
      break
    }
  }
  while (endMs > startMs && dateKeyMountain(new Date(endMs - 1000)) !== dateKey) {
    endMs -= 1000
  }
  while (dateKeyMountain(new Date(endMs)) === dateKey) {
    endMs += 1000
  }
  return { startMs, endMs }
}

/** Keys for reading cached build-brief editions (matches daily-digest cron). */
export function buildBriefEditionKeys(now = new Date()): string[] {
  const keys = [
    yesterdayMountainDateKey(now),
    yesterdayMountainDateKey(new Date(now.getTime() - 86400000)),
  ]
  return [...new Set(keys)]
}

/** Keys for reading cached homepage articles — brief edition plus today's live needle. */
export function editionReadKeys(now = new Date()): string[] {
  const keys = [dateKeyMountain(now), ...buildBriefEditionKeys(now)]
  return [...new Set(keys)]
}

function digestRedisKey(dateKey: string): string {
  return `${DIGEST_KEY_PREFIX}${dateKey}`
}

function briefRedisKey(dateKey: string): string {
  return `${BRIEF_KEY_PREFIX}${dateKey}`
}

function commitOnMountainDate(isoDate: string, mountainDateKey: string): boolean {
  return dateKeyMountain(new Date(isoDate)) === mountainDateKey
}

export function collectBuildActivityForMountainDay(
  stats: GitHubStats,
  repos: Repo[],
  mountainDateKey: string,
): RepoBuildActivity[] {
  const tagBySlug = new Map(repos.map(r => [r.githubSlug, getEffectiveTag(r)]))
  const out: RepoBuildActivity[] = []

  for (const [slug, activity] of Object.entries(stats.repoActivity)) {
    const fromRecent =
      activity.recentCommits?.filter(c => commitOnMountainDate(c.date, mountainDateKey)) ?? []
    let commits: string[] = fromRecent.map(c => c.message)

    if (!commits.length && activity.commitTimestamps?.length) {
      const onDay = activity.commitTimestamps.filter(ts => commitOnMountainDate(ts, mountainDateKey))
      if (onDay.length) {
        commits = onDay.map(() => 'Commit activity recorded')
      }
    }

    if (!commits.length) continue
    out.push({
      slug,
      tag: tagBySlug.get(slug) ?? 'theoretical',
      commits,
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

function formatPeriodActivityContext(stats: GitHubStats): string {
  const lines = (['24h', '7d', '30d', '60d'] as const).map(period => {
    const ws = builderWindowStatsFromGitHub(stats, period)
    const quiet = ws.commits === 0 ? 'QUIET — no commits in this window' : `${ws.commits} commits`
    return `  ${period}: ${quiet}`
  })
  return `PER-PERIOD ACTIVITY (use to decide what each card may honestly claim):\n${lines.join('\n')}`
}

function formatTopReposContext(stats: GitHubStats, repos: Repo[]): string {
  const periods: Period[] = ['24h', '7d', '30d', '60d']
  const lines = periods.map(period => {
    const shipping = topReposByCommits(stats, repos, period, 'current', 3)
    const holder = topReposByCommits(stats, repos, period, 'current', 3, isConsumerEconomicScored)
    const shipLabel = shipping.length
      ? shipping.map(r => `${r.name} (${r.commits})`).join(', ')
      : 'none'
    const holderLabel = holder.length
      ? holder.map(r => `${r.name} (${r.commits})`).join(', ')
      : 'none'
    return `  ${period}: top shipping — ${shipLabel}; top holder-facing — ${holderLabel}`
  })
  return `PER-PERIOD TOP PROJECTS (you may name 1-2 when one dominates a card):\n${lines.join('\n')}`
}

function formatGradeContext(stats: GitHubStats, repos: Repo[]): string {
  const periods: Period[] = ['24h', '7d', '30d', '60d']
  const periodGrades = periods
    .map(period => {
      const bg = calcBuilderGrade(stats, period)
      const tg = calcTokenMechanicGrade(stats, period, repos)
      const sg = calcShippingLeverageGrade(stats, period, repos)
      const ig = calcIntegrityGrade(stats, period, repos)
      const trend =
        period === '60d'
          ? 'no prior-window trend'
          : `trend ${bg.trend}${bg.trendPct != null ? ` (${bg.trendPct > 0 ? '+' : ''}${bg.trendPct}% vs prior)` : ''}`
      return [
        `${period} window:`,
        `  Builder activity: ${bg.letter} (${bg.pct}%), ${trend}`,
        `  Holder economics: ${tg.letter} (${tg.pct}%), ${tg.counts.repos} repos in sample${tg.holderCoveragePct != null ? `, ${tg.holderCoveragePct}% holder-facing commit share` : ''}`,
        `  Shipping leverage: ${sg.letter} (${sg.pct}%), ${sg.counts.repos} infra/tooling repos in sample`,
        `  Builder standards: ${ig.letter} (${ig.pct}%), ${ig.counts.commitWeight} commits weighted (${ig.counts.low} low / ${ig.counts.mid} mid / ${ig.counts.high} high)`,
      ].join('\n')
    })
    .join('\n\n')
  return `${formatPeriodActivityContext(stats)}\n\n${formatTopReposContext(stats, repos)}\n\n${periodGrades}`
}

const QUIET_GENERAL =
  'It was a quiet day across the sampled repos — no commits landed on the actively tracked GitHub projects. The grades above still reflect longer windows of activity and scoring. Check back tomorrow for a fresher picture of what shipped.'

function buildFallbackDigest(
  stats: GitHubStats,
  repos: Repo[],
  activity: RepoBuildActivity[],
  mountainDateKey: string,
): Omit<DailyDigestCache, 'generatedAt'> {
  const periods: Period[] = ['24h', '7d', '30d', '60d']
  const cards = {} as DailyDigestCards

  for (const period of periods) {
    const bg = calcBuilderGrade(stats, period)
    const tg = calcTokenMechanicGrade(stats, period, repos)
    const sg = calcShippingLeverageGrade(stats, period, repos)
    const ig = calcIntegrityGrade(stats, period, repos)
    const windowStats = builderWindowStatsFromGitHub(stats, period)
    cards[period] = {
      builder: builderCardLayman(bg, period, windowStats, stats, repos),
      economic: economicCardLayman(tg, period, { commits: windowStats.commits }, stats, repos),
      integrity: integrityCardLayman(ig, period, stats, repos),
      leverage: shippingLeverageCardLayman(sg, period, stats, repos),
    }
  }

  let general = QUIET_GENERAL
  let generalNormie =
    'It was a quiet day — none of the tracked projects got new updates. The grades above still cover longer windows. Check back tomorrow for a fresher picture of what shipped.'
  if (activity.length) {
    const names = activity
      .slice(0, 5)
      .map(a => `${a.slug} (${a.commits.length} commit${a.commits.length === 1 ? '' : 's'})`)
      .join(', ')
    const plainNames = activity
      .slice(0, 5)
      .map(a => `${a.slug} (${a.commits.length} update${a.commits.length === 1 ? '' : 's'})`)
      .join(', ')
    const extra = activity.length > 5 ? ` and ${activity.length - 5} more repos` : ''
    const plainExtra = activity.length > 5 ? ` and ${activity.length - 5} more projects` : ''
    general = `On ${mountainDateKey}, work landed on ${names}${extra}. `
    generalNormie = `On ${mountainDateKey}, these projects got updates: ${plainNames}${plainExtra}. `
    const burnCount = activity.filter(a => !hasShippingLeverageTag(a.tag as Repo['tag'])).length
    const leverageCount = activity.length - burnCount
    if (burnCount && leverageCount) {
      general += `${burnCount} burn-app repo${burnCount === 1 ? '' : 's'} and ${leverageCount} infra/leverage repo${leverageCount === 1 ? '' : 's'} saw commits. `
      generalNormie += `${burnCount} holder-facing app${burnCount === 1 ? '' : 's'} and ${leverageCount} behind-the-scenes tool${leverageCount === 1 ? '' : 's'} saw updates. `
    }
    general +=
      'The grade cards below put that activity in context across the 24-hour, 7-day, 30-day, and 60-day windows.'
    generalNormie +=
      'The grade cards below explain what that means for holders over the last day, week, month, and two months.'
  }

  return {
    general,
    generalNormie,
    cards,
    dateKey: mountainDateKey,
    repoCount: activity.length,
    commitCount: activity.reduce((n, a) => n + a.commits.length, 0),
  }
}

interface DigestAiPayload {
  general: string
  generalNormie?: string
  cards: DailyDigestCards
}

function cardsAreComplete(cards: DailyDigestCards | undefined): cards is DailyDigestCards {
  if (!cards) return false
  return (['24h', '7d', '30d', '60d'] as const).every(period => {
    const row = cards[period]
    return Boolean(row?.builder?.trim() && row.economic?.trim() && row.integrity?.trim())
  })
}

/** Plain overview (or JSON `general` if the model still wraps it). */
function extractOverviewProse(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const fromJson = parseDigestJson(raw)?.general?.trim()
  if (fromJson) return stripMarkdown(fromJson)
  const text = stripMarkdown(raw).trim()
  if (text.length < 80) return null
  if (text.startsWith('{') || text.startsWith('[')) return null
  return text
}

/** Parse STANDARD: / PLAIN: dual blocks (or JSON general/generalNormie). */
function extractLabeledPair(raw: string | undefined): { standard: string; plain?: string } | null {
  if (!raw?.trim()) return null
  const labeled = splitStandardPlainLabeled(raw)
  if (labeled?.standard) return labeled
  const fromJson = parseDigestJson(raw)
  if (fromJson?.general?.trim()) {
    return {
      standard: stripMarkdown(fromJson.general),
      ...(fromJson.generalNormie?.trim() ? { plain: stripMarkdown(fromJson.generalNormie) } : {}),
    }
  }
  return null
}

/**
 * Deterministic Plain English when Redis has no generalNormie (old template /
 * AI overview without a rewrite). Keeps the toggle from looking broken.
 */
function simplifyBriefForNormie(general: string): string {
  const fromLabeled = preferPlainFromLabeled(general)
  const g = (fromLabeled ?? general).trim()
  if (!g) return g
  if (g === QUIET_GENERAL) {
    return 'It was a quiet day — none of the tracked projects got new updates. The grades above still cover longer windows. Check back tomorrow for a fresher picture of what shipped.'
  }
  return g
    .replace(/\bburn-app repos?\b/gi, 'holder-facing apps')
    .replace(/\binfra\/leverage repos?\b/gi, 'behind-the-scenes tools')
    .replace(/\brepos?\b/gi, 'projects')
    .replace(/\bcommits?\b/gi, 'updates')
    .replace(/\bwork landed on\b/gi, 'these projects got updates:')
    .replace(
      /The grade cards below put that activity in context across the 24-hour, 7-day, 30-day, and 60-day windows\./gi,
      'The grade cards below explain what that means for holders over the last day, week, month, and two months.',
    )
}

/** Last-ditch pull of "general" when the model truncates mid-JSON. */
function extractGeneralFromPartial(raw: string): string | null {
  const match = raw.match(/"general"\s*:\s*"((?:\\.|[^"\\])*)"/)
  if (!match) return null
  try {
    const text = JSON.parse(`"${match[1]}"`)
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch {
    return match[1]?.trim() || null
  }
}

function parseDigestJson(raw: string): DigestAiPayload | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) {
    const general = extractGeneralFromPartial(trimmed)
    return general ? { general, cards: {} as DailyDigestCards } : null
  }
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as DigestAiPayload
    if (!parsed.general?.trim()) {
      const general = extractGeneralFromPartial(trimmed)
      return general ? { general, cards: {} as DailyDigestCards } : null
    }
    if (!cardsAreComplete(parsed.cards)) {
      // Keep the overview even when card JSON was truncated — grade cards use live fallback copy.
      return {
        general: parsed.general,
        ...(parsed.generalNormie?.trim() ? { generalNormie: parsed.generalNormie } : {}),
        cards: {} as DailyDigestCards,
      }
    }
    return parsed
  } catch {
    const general = extractGeneralFromPartial(trimmed)
    return general ? { general, cards: {} as DailyDigestCards } : null
  }
}

function isTemplateFallbackGeneral(general: string): boolean {
  const g = general.trim()
  if (!g) return true
  if (g === QUIET_GENERAL) return true
  if (g.includes('The grade cards below put that activity in context')) return true
  return /^On \d{4}-\d{2}-\d{2}, work landed on /.test(g)
}

/** True when cron should try the model again instead of serving a stuck template. */
function isRetryableDigest(digest: DailyDigestCache): boolean {
  if (digest.source === 'fallback') return true
  if (digest.source === 'ai') return false
  return isTemplateFallbackGeneral(digest.general)
}

async function generateDigestWithAi(
  activity: RepoBuildActivity[],
  gradeContext: string,
  mountainDateKey: string,
): Promise<DigestAiPayload | null> {
  if (!hasLlmApiKey()) return null

  const facts = `You write copy for The Build Report — an independent dashboard that tracks clawdbotatg's GitHub repos for $CLAWD holders.

Summarize ${mountainDateKey} (America/Denver / Mountain calendar day, midnight to midnight).

COMMITS THAT DAY (sampled active repos only — do not invent repos or work):
${formatActivityForPrompt(activity, mountainDateKey)}

CURRENT GRADES (use for context; card copy should match the period label):
${gradeContext}`

  const overview = await generateDigestOverview(facts, activity)
  if (!overview) return null
  const cards = await generateDigestCards(facts)
  return { ...overview, cards: cards ?? ({} as DailyDigestCards) }
}

async function generateDigestOverview(
  facts: string,
  activity: RepoBuildActivity[],
): Promise<Pick<DigestAiPayload, 'general' | 'generalNormie'> | null> {
  const prompt = `${facts}

Write TWO versions of the day's overview, in this exact layout:

STANDARD:
5-6 complete sentences, meatier than any single grade card. Name specific repos/work from the commit list and explain why it matters to holders. Warm, clear, a little personality — like a sharp friend explaining the day. Not degen, not hype, no crypto slang. Mention specific repos only if listed above.

PLAIN:
Same facts and the same repo slugs — simpler words, not a compressed summary. Keep every slug STANDARD names (optional short plain gloss after a name is fine). Never swap a named project for "the main interface", "the research team", "some backend fixes", or similar vague stand-ins. 2-5 sentences as needed.
${normieVoiceGuidance('digestGeneral')}

Return ONLY those two labeled blocks. No JSON, no markdown, no title.`

  // Homepage copy must not fall back to a public template just because Gemini
  // is briefly overloaded. This rotates Gemini keys, then fails over to Haiku.
  const { text, provider } = await generateTextGeminiFirst({
    prompt,
    maxTokens: 3072,
    temperature: NORMIE_TEMPERATURE,
    label: 'build-brief-overview',
    usable: raw => Boolean(extractLabeledPair(raw)?.standard || extractOverviewProse(raw)),
  })
  const pair = extractLabeledPair(text)
  const general = pair?.standard ?? extractOverviewProse(text)
  if (!general) {
    console.error('[build-brief] failed to read overview prose', {
      provider,
      length: text?.length ?? 0,
      preview: (text ?? '').slice(0, 400),
    })
    return null
  }

  let generalNormie = pair?.plain
  const activitySlugs = activity.map(a => a.slug)
  if (generalNormie) {
    const missing = missingNamedRepos(general, generalNormie, activitySlugs)
    if (missing.length > 0) {
      // Keep the rewrite anyway — dropping it makes Plain English look broken.
      console.warn('[build-brief] generalNormie missing some repo names; keeping rewrite', { missing })
    }
  } else {
    generalNormie = simplifyBriefForNormie(general)
  }

  return { general, ...(generalNormie ? { generalNormie } : {}) }
}

async function generateDigestCards(facts: string): Promise<DailyDigestCards | null> {
  const prompt = `${facts}

Return ONLY valid JSON, no markdown fences:
{
  "cards": {
    "24h": {
      "builder": "2-3 sentences about builder activity for the last 24 hours.",
      "economic": "2-3 sentences about holder economics for the last 24 hours.",
      "leverage": "2-3 sentences about shipping leverage for the last 24 hours.",
      "integrity": "2-3 sentences about builder standards for the last 24 hours.",
      "normie": { "builder": "…", "economic": "…", "leverage": "…", "integrity": "…" }
    },
    "7d": { "builder": "…", "economic": "…", "leverage": "…", "integrity": "…", "normie": { "builder": "…", "economic": "…", "leverage": "…", "integrity": "…" } },
    "30d": { "builder": "…", "economic": "…", "leverage": "…", "integrity": "…", "normie": { "builder": "…", "economic": "…", "leverage": "…", "integrity": "…" } },
    "60d": { "builder": "…", "economic": "…", "leverage": "…", "integrity": "…", "normie": { "builder": "…", "economic": "…", "leverage": "…", "integrity": "…" } }
  }
}

CARD NORMIE VOICE GUIDE (applies to every card "normie" field):
${normieVoiceGuidance('gradeCard')}

Rules:
- Each card field: 2-3 complete sentences. Each period must sound DISTINCT from the others — a holder toggling 24h vs 30d should read different stories.
- If a period shows QUIET (zero commits) in PER-PERIOD ACTIVITY, say so plainly in that period's cards. Do not write motivational filler or imply work happened.
- If holder economics or builder standards have zero commit weight / empty sample, say we cannot draw a strong read for that window yet.
- 60d cards: describe the two-month arc. Do not imply week-over-week trend or compare to a prior 60d window.
- 24h with no activity: one short honest sentence per card beats three padded ones.
- CARD COPY MUST BE PLAIN WORDS — no percentages, letter grades, or raw stats dumps in the card fields. You MAY name specific projects when PER-PERIOD TOP PROJECTS shows one repo dominated that window.
- Never use insider jargon in card copy: no "infra", "R&D", "commits", "repos", "rubric", "token mechanics", "TM", "supply-lock", "direct-tag". Explain like you're talking to a normal person who holds the token, not a developer.
- Say "holder economics" or "how apps and locks serve $CLAWD holders" instead of "token mechanics" or "burn apps" alone.
- Shipping leverage = the behind-the-scenes tooling and infrastructure that multiplies how fast the builder can ship apps holders benefit from. It is a sibling lens to holder economics (not direct burn). If the leverage context shows an empty sample or QUIET, say we cannot draw a strong read for that window yet.
- Builder standards copy = observable rubric quality where commits landed — safety, testing, transparency. Not a moral verdict on the builder. Never say "trust" without context (e.g. trust in documented safety practices). Not moralizing.
- If standards context shows below 60% or mostly low-scoring commits, the copy must acknowledge weak rubric scores — do not describe the window as steady, polished, or low-risk unless that matches the grade context.
- Holder economics context may show low holder-facing commit share — if so, say plainly that most shipping was background tooling and holder value delivery was thin this window.
- Card fields should stay high-level and plain.`

  try {
    const { text, provider } = await generateTextGeminiOnly({
      prompt,
      maxTokens: 6144,
      temperature: NORMIE_TEMPERATURE,
      label: 'build-brief-cards',
      usable: raw => Boolean(parseCardsJson(raw)),
    })
    if (!text) {
      console.warn('[build-brief] empty card response', { provider })
      return null
    }
    const cards = parseCardsJson(text)
    if (!cards) {
      console.warn('[build-brief] card JSON incomplete — using live card copy', {
        provider,
        length: text.length,
        preview: text.slice(0, 300),
      })
      return null
    }
    return cards
  } catch (err) {
    console.warn('[build-brief] card generation failed; using live card copy:', err)
    return null
  }
}

function parseCardsJson(raw: string): DailyDigestCards | null {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      cards?: DailyDigestCards
      '24h'?: CardBlurbs
    }
    const cards = parsed.cards ?? (parsed['24h'] ? (parsed as DailyDigestCards) : undefined)
    if (!cardsAreComplete(cards)) return null
    return mapDigestCards(cards)
  } catch {
    return null
  }
}

function mapDigestCards(cards: DailyDigestCards): DailyDigestCards {
  const mapRow = (row: CardBlurbs): CardBlurbs => ({
    builder: stripMarkdown(row.builder),
    economic: stripMarkdown(row.economic),
    integrity: stripMarkdown(row.integrity),
    ...(row.leverage ? { leverage: stripMarkdown(row.leverage) } : {}),
    ...(row.normie
      ? {
          normie: {
            builder: stripMarkdown(row.normie.builder),
            economic: stripMarkdown(row.normie.economic),
            integrity: stripMarkdown(row.normie.integrity),
            ...(row.normie.leverage ? { leverage: stripMarkdown(row.normie.leverage) } : {}),
          },
        }
      : {}),
  })
  return {
    '24h': mapRow(cards['24h']),
    '7d': mapRow(cards['7d']),
    '30d': mapRow(cards['30d']),
    '60d': mapRow(cards['60d']),
  }
}

/** One-shot rewrite when Plain English overview dropped repo identity anchors. */
async function repairGeneralNormie(
  general: string,
  generalNormie: string,
  missingSlugs: string[],
): Promise<string | null> {
  if (!hasGeminiApiKey()) return null
  try {
    const { text } = await generateTextGeminiOnly({
      prompt: `Rewrite the plain-English overview so it keeps the same repo identity as the standard overview.

STANDARD OVERVIEW (source of truth for which repos and topics):
${general}

PLAIN-ENGLISH DRAFT (warmer/simpler, but it dropped or blurred these repo names: ${missingSlugs.join(', ')}):
${generalNormie}

Return ONLY the repaired plain-English overview as plain text (no JSON, no markdown). Rules:
- Keep every repo slug the standard overview names (${missingSlugs.join(', ')} must appear).
- You may add a short plain gloss after a slug (e.g. "fwaah — the prediction-game dashboard — …").
- Same facts and topics; simpler words; warm friend voice.
- Never replace a named repo with a vague stand-in like "the main interface" or "the research team".
${normieVoiceGuidance('digestGeneral')}`,
      maxTokens: 1024,
      temperature: NORMIE_TEMPERATURE,
      label: 'build-brief-normie-repair',
    })
    const cleaned = text ? stripMarkdown(text.trim()) : ''
    return cleaned || null
  } catch (err) {
    console.error('[build-brief] generalNormie repair failed:', err)
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
    await indexArchiveDate(BRIEF_DATES_INDEX_KEY, dateKey)
  } catch {
    // non-fatal
  }
}

export async function generateAndCacheDailyDigest(
  stats: GitHubStats,
  repos: Repo[],
  mountainDateKey = yesterdayMountainDateKey(),
  options?: { force?: boolean },
): Promise<DailyDigestCache> {
  const existing = await readCachedDigest(mountainDateKey)
  if (!options?.force) {
    // A template fallback is not "done" — retry so CLAWD cannot get stuck on backup copy.
    if (existing?.general?.trim() && !isRetryableDigest(existing)) return existing
  }

  const activity = collectBuildActivityForMountainDay(stats, repos, mountainDateKey)
  const commitCount = activity.reduce((n, a) => n + a.commits.length, 0)
  const gradeContext = formatGradeContext(stats, repos)

  let ai: DigestAiPayload | null = null
  let geminiError: string | undefined
  try {
    ai = await generateDigestWithAi(activity, gradeContext, mountainDateKey)
  } catch (err) {
    geminiError = err instanceof Error ? err.message : 'Gemini failed'
    console.error('[build-brief] digest AI generation failed:', err)
  }
  const fallback = buildFallbackDigest(stats, repos, activity, mountainDateKey)
  const aiOverview = Boolean(ai?.general?.trim())
  const aiCards = cardsAreComplete(ai?.cards) ? ai.cards : null
  if (!aiOverview && existing && !isRetryableDigest(existing)) {
    console.warn('[build-brief] AI failed; keeping previous AI digest', { mountainDateKey })
    return existing
  }
  if (!aiOverview) {
    console.warn('[build-brief] using template fallback digest', {
      mountainDateKey,
      repoCount: activity.length,
      commitCount,
      geminiError: geminiError ?? (hasGeminiApiKey() ? 'empty or unparseable overview' : 'GEMINI_API_KEY missing'),
    })
  } else if (!aiCards) {
    console.warn('[build-brief] AI overview saved; card fields fell back to live copy', {
      mountainDateKey,
    })
  }

  const general = aiOverview ? ai!.general : fallback.general
  const generalNormie =
    (aiOverview ? ai?.generalNormie : fallback.generalNormie)?.trim() ||
    simplifyBriefForNormie(general)

  const payload: DailyDigestCache = {
    general,
    ...(generalNormie ? { generalNormie } : {}),
    cards: aiCards ?? fallback.cards,
    dateKey: mountainDateKey,
    repoCount: activity.length,
    commitCount,
    generatedAt: new Date().toISOString(),
    source: aiOverview ? 'ai' : 'fallback',
  }

  await cacheDailyDigest(mountainDateKey, payload)
  return { ...payload, ...(geminiError && !aiOverview ? { geminiError } : {}) }
}

export async function generateAndCacheBuildBrief(
  stats: GitHubStats,
  repos: Repo[],
  mountainDateKey = yesterdayMountainDateKey(),
): Promise<{
  text: string
  repoCount: number
  commitCount: number
  generatedAt: string
  source?: 'ai' | 'fallback'
  geminiError?: string
}> {
  const digest = await generateAndCacheDailyDigest(stats, repos, mountainDateKey, { force: true })
  return {
    text: digest.general,
    repoCount: digest.repoCount,
    commitCount: digest.commitCount,
    generatedAt: digest.generatedAt,
    source: digest.source,
    ...(digest.geminiError ? { geminiError: digest.geminiError } : {}),
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

/** Public read for Archives — one Mountain calendar edition (digest, or legacy brief). */
export async function getCachedDigestForDate(dateKey: string): Promise<DailyDigestCache | null> {
  const digest = await readCachedDigest(dateKey)
  // Emergency templates remain internal retry state, never a published archive.
  if (digest) return isRetryableDigest(digest) ? null : digest

  // Older editions were stored as build-brief:{date} without card blurbs.
  const legacy = await readLegacyBrief(dateKey)
  if (!legacy || isTemplateFallbackGeneral(legacy.text)) return null
  const empty: CardBlurbs = { builder: '', economic: '', integrity: '' }
  return {
    general: legacy.text,
    cards: { '24h': empty, '7d': empty, '30d': empty, '60d': empty },
    dateKey,
    repoCount: legacy.repoCount,
    commitCount: legacy.commitCount,
    generatedAt: legacy.generatedAt,
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

export function toBuildBriefData(digest: DailyDigestCache): BuildBriefData {
  // Cached digests sometimes store the whole STANDARD:/PLAIN: blob in `general`
  // when the model omitted a newline before PLAIN — split on read so the toggle works.
  const split = splitStandardPlainLabeled(digest.general)
  const general =
    preferStandardFromLabeled(digest.general) ?? digest.general.replace(/^STANDARD\s*:\s*/i, '').trim()

  let generalNormie = digest.generalNormie?.trim() || undefined
  if (generalNormie) {
    generalNormie =
      preferPlainFromLabeled(generalNormie) ??
      preferStandardFromLabeled(generalNormie) ??
      generalNormie
  } else if (split?.plain) {
    generalNormie = split.plain
  }
  if (!generalNormie) {
    generalNormie = simplifyBriefForNormie(general)
  }

  return {
    text: general,
    general,
    ...(generalNormie ? { generalNormie } : {}),
    cards: digest.cards,
    dateKey: digest.dateKey,
    isToday: false,
    repoCount: digest.repoCount,
    commitCount: digest.commitCount,
    generatedAt: digest.generatedAt,
  }
}

export async function getBuildBrief(): Promise<BuildBriefData | null> {
  for (const targetKey of buildBriefEditionKeys()) {
    const digest = await readCachedDigest(targetKey)
    // If today's model run failed, show the previous completed edition instead
    // of publishing deterministic emergency copy as real editorial output.
    if (digest && !isRetryableDigest(digest)) return toBuildBriefData(digest)
  }

  const targetKey = buildBriefEditionKeys()[0]
  const legacy = await readLegacyBrief(targetKey)
  if (legacy && !isTemplateFallbackGeneral(legacy.text)) {
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
  card: 'builder' | 'economic' | 'integrity' | 'leverage',
): string | null {
  return brief?.cards?.[period]?.[card] ?? null
}
