import { generateTextGeminiOnly, hasGeminiApiKey } from '@/lib/llm'
import { getRedis } from '@/lib/redis'
import { getSlugsRescoredBetween } from '@/lib/scoreHistory'
import { getRescoreSummaries, type RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import { REPOS } from '@/lib/scores'
import { stripMarkdown } from '@/lib/textCleanup'
import { NORMIE_TEMPERATURE, normieVoiceGuidance } from '@/lib/normieVoice'
import {
  preferPlainFromLabeled,
  preferStandardFromLabeled,
  splitStandardPlainLabeled,
} from '@/lib/labeledLlmPair'
import {
  dateKeyMountain,
  editionReadKeys,
  mountainDateKeyBoundsMs,
  type RepoBuildActivity,
} from '@/lib/buildBrief'
import { indexArchiveDate, NEEDLE_DATES_INDEX_KEY } from '@/lib/archiveIndex'

const NEEDLE_KEY_PREFIX = 'build-report:needle:'
const NEEDLE_TTL_SEC = 90 * 24 * 3600

export interface NeedleData {
  text: string
  /** Optional plain-English version for Normie mode; older cache entries omit this. */
  textNormie?: string
  dateKey: string
  repoCount: number
  generatedAt: string
  /** Older cache entries omit this. Fallback copy is retryable. */
  source?: 'ai' | 'fallback'
}

type QualifyingMove = {
  name: string
  biOld: string | null
  biNew: string | null
  ecOld: string | null
  ecNew: string | null
  deltaHeader: string | null
  summary: string | null
}

function needleRedisKey(dateKey: string): string {
  return `${NEEDLE_KEY_PREFIX}${dateKey}`
}

function formatMoveLines(qualifying: QualifyingMove[]): string {
  if (!qualifying.length) return '(none)'
  return qualifying
    .map(q => {
      const gradeMoved = q.biOld !== q.biNew || q.ecOld !== q.ecNew
      const parts: string[] = []
      parts.push(`builder standards ${q.biOld} → ${q.biNew}`)
      parts.push(`holder economics ${q.ecOld ?? '—'} → ${q.ecNew ?? '—'}`)
      return `${q.name} (overall ${gradeMoved ? 'MOVED' : 'flat'}): ${parts.join(', ')}. Rubric detail: ${q.deltaHeader || 'none'}. Rescore notes: ${q.summary || 'none'}`
    })
    .join('\n\n')
}

function formatActivityLines(activity: RepoBuildActivity[]): string {
  if (!activity.length) return '(none)'
  return activity
    .slice(0, 12)
    .map(row => {
      const msgs = row.commits.slice(0, 6).map(m => `  - ${m}`).join('\n')
      const extra = row.commits.length > 6 ? `\n  - …and ${row.commits.length - 6} more` : ''
      return `${row.slug} (${row.commits.length} commit${row.commits.length === 1 ? '' : 's'}):\n${msgs}${extra}`
    })
    .join('\n\n')
}

function buildFallbackNeedle(
  qualifying: QualifyingMove[],
  activity: RepoBuildActivity[],
): { text: string; textNormie: string } {
  if (qualifying.length) {
    const names = qualifying.map(q => q.name)
    const lead = names[0]
    const rest =
      names.length === 1
        ? ''
        : names.length === 2
          ? ` and ${names[1]}`
          : `, plus ${names.length - 1} other repos`
    const text =
      `${lead}${rest} got a fresh overnight score. ` +
      `Biggest holder signal: grades moved where the work actually changed the read — not just commit noise.`
    const textNormie =
      `${lead}${rest} got a fresh overnight score. ` +
      `That means the scoreboard changed for holders for real, not just because someone pushed code.`
    return { text, textNormie }
  }

  const names = activity.slice(0, 3).map(a => a.slug)
  const lead = names[0] ?? 'Tracked repos'
  const rest =
    names.length <= 1
      ? ''
      : names.length === 2
        ? ` and ${names[1]}`
        : `, plus ${activity.length - 1} other projects`
  const text =
    `${lead}${rest} shipped overnight. ` +
    `Holder takeaway: watch whether that work shows up in apps, locks, or shipping leverage — grades refresh on the overnight pass.`
  const textNormie =
    `${lead}${rest} got updates overnight. ` +
    `For holders: look for work that helps apps, burns/locks, or the tools that make shipping those things faster.`
  return { text, textNormie }
}

function isFallbackNeedleCopy(data: Pick<NeedleData, 'text' | 'textNormie' | 'source'>): boolean {
  if (data.source === 'fallback') return true
  if (data.source === 'ai') return false
  const blob = `${data.text} ${data.textNormie ?? ''}`
  return (
    blob.includes('got a fresh score and the grade actually moved') ||
    blob.includes('Biggest signal: grade letters shifted') ||
    blob.includes('got a fresh overnight score')
  )
}

function extractLabeledNeedle(raw: string | undefined): { text: string; textNormie?: string } | null {
  if (!raw?.trim()) return null
  const labeled = splitStandardPlainLabeled(raw)
  if (labeled?.standard) {
    return {
      text: labeled.standard,
      ...(labeled.plain ? { textNormie: labeled.plain } : {}),
    }
  }
  const cleaned = stripMarkdown(raw).trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { text?: unknown; textNormie?: unknown }
      const text = typeof parsed.text === 'string' ? stripMarkdown(parsed.text).trim() : ''
      if (text.length >= 40) {
        const textNormie =
          typeof parsed.textNormie === 'string' ? stripMarkdown(parsed.textNormie).trim() : ''
        return textNormie ? { text, textNormie } : { text }
      }
    } catch {
      // fall through
    }
  }
  if (cleaned.length < 40) return null
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) return null
  return { text: cleaned.replace(/^STANDARD\s*:\s*/i, '').trim() }
}

/** Fix cached dual STANDARD/PLAIN blobs so Plain English can show the PLAIN half. */
function sanitizeNeedleData(data: NeedleData): NeedleData {
  const split = splitStandardPlainLabeled(data.text)
  const text =
    preferStandardFromLabeled(data.text) ??
    data.text.replace(/^STANDARD\s*:\s*/i, '').trim()

  let textNormie = data.textNormie?.trim() || undefined
  if (textNormie) {
    const fromNormieField = preferPlainFromLabeled(textNormie)
    if (fromNormieField) textNormie = fromNormieField
  }

  // AI often landed both halves in `text` while `textNormie` stayed on template fallback.
  if (split?.plain) {
    const normieIsFallback =
      !textNormie ||
      data.source === 'fallback' ||
      textNormie.includes('got a fresh overnight score') ||
      textNormie.includes('That means the scoreboard changed for holders for real')
    if (normieIsFallback) textNormie = split.plain
  }

  if (!textNormie) {
    textNormie =
      preferPlainFromLabeled(data.text) ??
      undefined
  }

  return {
    ...data,
    text,
    ...(textNormie ? { textNormie } : {}),
  }
}

async function generateNeedleCopy(
  qualifying: QualifyingMove[],
  activity: RepoBuildActivity[],
): Promise<{ text: string; textNormie?: string } | null> {
  if (!hasGeminiApiKey()) return null

  const prompt = `You write a very short daily column called "The Needle" for The Build Report — for $CLAWD token holders.

Date window: Mountain calendar overnight edition.

SHIPPING ACTIVITY (same sample Yesterday's Build sees — commits that day):
${formatActivityLines(activity)}

OVERNIGHT / RESCORE NOTES (grades + What changed when a live rescore ran):
${formatMoveLines(qualifying)}

Write TWO versions in this exact layout:

STANDARD:
2-3 sentences. Pick the single most holder-relevant signal — an app/lock/burn path, shipping leverage that multiplies holder-facing work, or a grade move that changes the holder read. Casual, direct. Name specific repos when listed above. Do NOT invent grade moves from commits alone — only cite grade/rubric changes when OVERNIGHT / RESCORE NOTES include them. Do NOT invent missing README/docs unless a rescore note says so.

PLAIN:
Same facts and repo names, for someone who knows nothing about code.
${normieVoiceGuidance('needle')}

Return ONLY those two labeled blocks. No JSON, no markdown, no title.`

  try {
    const { text: raw } = await generateTextGeminiOnly({
      prompt,
      maxTokens: 1024,
      temperature: NORMIE_TEMPERATURE,
      label: 'needle',
      usable: r => Boolean(extractLabeledNeedle(r)?.text),
    })
    const parsed = extractLabeledNeedle(raw)
    if (!parsed) {
      console.error('[needle] empty or unreadable LLM response', { preview: (raw ?? '').slice(0, 400) })
      return null
    }
    return parsed
  } catch (err) {
    console.error('[needle] AI generation failed', err)
    return null
  }
}

export type GenerateNeedleOptions = {
  /** Defaults to today Mountain — use yesterdayMountainDateKey() from daily-digest cron for brief sync. */
  dateKey?: string
  /** Regenerate even if a cached Needle already exists for the date. */
  force?: boolean
  /** Same Mountain-day activity YB uses — expands Needle inputs beyond paid/overnight rescored slugs. */
  activity?: RepoBuildActivity[]
}

export async function generateAndCacheNeedle(
  options: GenerateNeedleOptions = {},
): Promise<NeedleData | null> {
  const redis = getRedis()
  const dateKey = options.dateKey ?? dateKeyMountain()
  const existing = await readCachedNeedle(dateKey)
  if (!options.force && existing && !isFallbackNeedleCopy(existing)) return existing

  const activity = options.activity ?? []
  const { startMs, endMs } = mountainDateKeyBoundsMs(dateKey)
  const slugs = await getSlugsRescoredBetween(startMs, endMs)
  const summaries = slugs.length ? await getRescoreSummaries(slugs) : {}
  const nameBySlug = new Map(REPOS.map(r => [r.githubSlug, r.name]))

  const qualifying: QualifyingMove[] = Object.entries(summaries)
    .filter(([, meta]) => {
      const at = Date.parse(meta.rescoreAt)
      if (!Number.isFinite(at)) return false
      return at >= startMs && at < endMs && dateKeyMountain(new Date(at)) === dateKey
    })
    .map(([slug, meta]) => ({
      name: nameBySlug.get(slug) ?? slug,
      biOld: meta.oldBuilderIntegrity,
      biNew: meta.newBuilderIntegrity,
      ecOld: meta.oldTokenMechanic,
      ecNew: meta.newTokenMechanic,
      deltaHeader: meta.deltaHeader ?? null,
      summary: meta.summary ?? null,
    }))

  if (!qualifying.length && !activity.length) return existing ?? null

  const ai = await generateNeedleCopy(qualifying, activity)
  if (!ai && existing && !isFallbackNeedleCopy(existing)) {
    console.warn('[needle] AI failed; keeping previous AI Needle', { dateKey })
    return existing
  }
  const fallback = buildFallbackNeedle(qualifying, activity)
  const text = ai?.text ?? fallback.text
  const textNormie = ai?.textNormie ?? fallback.textNormie
  const evidenceSlugs = new Set([
    ...qualifying.map(q => q.name),
    ...activity.map(a => a.slug),
  ])

  const data: NeedleData = {
    text,
    textNormie,
    dateKey,
    repoCount: evidenceSlugs.size || Math.max(qualifying.length, activity.length),
    generatedAt: new Date().toISOString(),
    source: ai ? 'ai' : 'fallback',
  }

  const sanitized = sanitizeNeedleData(data)
  await redis.set(needleRedisKey(dateKey), sanitized, { ex: NEEDLE_TTL_SEC })
  await indexArchiveDate(NEEDLE_DATES_INDEX_KEY, dateKey)
  return sanitized
}

/** Fire-and-forget refresh after a rescore so The Needle stays current intraday. */
export function refreshNeedleAfterRescore(): void {
  void generateAndCacheNeedle({ force: true }).catch(err => {
    console.error('[needle] post-rescore refresh failed', err)
  })
}

async function readCachedNeedle(dateKey: string): Promise<NeedleData | null> {
  const redis = getRedis()
  const cached = await redis.get<NeedleData>(needleRedisKey(dateKey))
  return cached ? sanitizeNeedleData(cached) : null
}

/** Public read for Archives — one Mountain calendar edition. */
export async function getCachedNeedleForDate(dateKey: string): Promise<NeedleData | null> {
  try {
    return await readCachedNeedle(dateKey)
  } catch {
    return null
  }
}

export async function getNeedle(): Promise<NeedleData | null> {
  try {
    const keys = editionReadKeys()
    for (const key of keys) {
      const cached = await readCachedNeedle(key)
      if (cached) return cached
    }
    return null
  } catch {
    return null
  }
}
