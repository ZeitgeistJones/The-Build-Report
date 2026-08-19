import { generateTextGeminiOnly, hasGeminiApiKey } from '@/lib/llm'
import { getRedis } from '@/lib/redis'
import { getSlugsRescoredBetween } from '@/lib/scoreHistory'
import { getRescoreSummaries, type RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import { REPOS } from '@/lib/scores'
import { stripMarkdown } from '@/lib/textCleanup'
import { NORMIE_TEMPERATURE, normieVoiceGuidance } from '@/lib/normieVoice'
import {
  dateKeyMountain,
  editionReadKeys,
  mountainDateKeyBoundsMs,
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

function qualifyingChange(_meta: RescoreSummaryRecord): boolean {
  return true
}

function formatMoveLines(qualifying: QualifyingMove[]): string {
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

function buildFallbackNeedle(qualifying: QualifyingMove[]): { text: string; textNormie: string } {
  const names = qualifying.map(q => q.name)
  const lead = names[0]
  const rest =
    names.length === 1
      ? ''
      : names.length === 2
        ? ` and ${names[1]}`
        : `, plus ${names.length - 1} other repos`
  const text =
    `${lead}${rest} moved on a rescore in the last day. ` +
    `Biggest signal: grade letters shifted where the score actually changed — not just commit noise.`
  const textNormie =
    `${lead}${rest} got a fresh score and the grade actually moved. ` +
    `That means the scoreboard changed for real, not just because someone pushed code.`
  return { text, textNormie }
}

function isFallbackNeedleCopy(data: Pick<NeedleData, 'text' | 'textNormie' | 'source'>): boolean {
  if (data.source === 'fallback') return true
  if (data.source === 'ai') return false
  const blob = `${data.text} ${data.textNormie ?? ''}`
  return (
    blob.includes('got a fresh score and the grade actually moved') ||
    blob.includes('Biggest signal: grade letters shifted')
  )
}

function extractNeedleProse(raw: string | undefined): { text: string; textNormie?: string } | null {
  if (!raw?.trim()) return null
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
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
      // fall through to plain prose
    }
  }
  const text = stripMarkdown(raw).trim()
  if (text.length < 40) return null
  if (text.startsWith('{') || text.startsWith('[')) return null
  if (/^return only valid json/i.test(text)) return null
  return { text }
}

async function generateNeedleCopy(
  qualifying: QualifyingMove[],
): Promise<{ text: string; textNormie?: string } | null> {
  if (!hasGeminiApiKey()) return null

  const lines = formatMoveLines(qualifying)
  const prompt = `You write a very short daily column called "The Needle" for a crypto ecosystem scoring site. It reports on today's rescores — sometimes the overall grade moved, sometimes it held flat even though specific rubric rows changed underneath. Here is today's rescore data:

${lines}

Write 2-3 sentences total, no more. Pick the single most interesting thing that happened — this could be an overall grade move, OR a specific rubric row that improved/declined even though the overall grade held flat. If nothing moved overall, explain specifically what DID change at the rubric level and why it wasn't enough to shift the letter grade or percentage yet. Be specific — name the actual thing that changed (a security audit, a new test, a dependency, whatever the rescore notes mention), not just "held steady." Casual, direct, no fluff, no headers, no bullet points. Just plain prose.

Do NOT invent that README, root files, architecture docs, or plans are missing unless the rescore notes explicitly say so with high confidence. Prefer the deltaHeader grade moves and named rubric changes over speculative documentation-gap stories.

Return ONLY the column as plain prose. No JSON, no markdown, no title.`

  try {
    const { text: raw } = await generateTextGeminiOnly({
      prompt,
      maxTokens: 1024,
      temperature: NORMIE_TEMPERATURE,
      label: 'needle',
      usable: r => Boolean(extractNeedleProse(r)?.text),
    })
    const parsed = extractNeedleProse(raw)
    if (!parsed) {
      console.error('[needle] empty or unreadable LLM response', { preview: (raw ?? '').slice(0, 400) })
      return null
    }

    if (parsed.textNormie) return parsed

    try {
      const { text: normieRaw } = await generateTextGeminiOnly({
        prompt: `Rewrite this Needle column for someone who knows nothing about code or crypto. Keep the same facts and the same repo names.

STANDARD COLUMN:
${parsed.text}

${normieVoiceGuidance('needle')}

Return ONLY the rewrite as plain prose. No JSON, no markdown.`,
        maxTokens: 1024,
        temperature: NORMIE_TEMPERATURE,
        label: 'needle-normie',
        usable: r => Boolean(extractNeedleProse(r)?.text),
      })
      const normie = extractNeedleProse(normieRaw)?.text
      return normie ? { text: parsed.text, textNormie: normie } : parsed
    } catch (err) {
      console.warn('[needle] normie rewrite failed; keeping standard column', err)
      return parsed
    }
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
}

export async function generateAndCacheNeedle(
  options: GenerateNeedleOptions = {},
): Promise<NeedleData | null> {
  const redis = getRedis()
  const dateKey = options.dateKey ?? dateKeyMountain()
  const existing = await readCachedNeedle(dateKey)
  if (!options.force && existing && !isFallbackNeedleCopy(existing)) return existing
  const { startMs, endMs } = mountainDateKeyBoundsMs(dateKey)
  const slugs = await getSlugsRescoredBetween(startMs, endMs)
  if (!slugs.length) return existing ?? null

  const summaries = await getRescoreSummaries(slugs)
  const nameBySlug = new Map(REPOS.map(r => [r.githubSlug, r.name]))

  const qualifying: QualifyingMove[] = Object.entries(summaries)
    .filter(([, meta]) => {
      if (!qualifyingChange(meta)) return false
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

  if (!qualifying.length) return existing ?? null

  const ai = await generateNeedleCopy(qualifying)
  if (!ai && existing && !isFallbackNeedleCopy(existing)) {
    console.warn('[needle] AI failed; keeping previous AI Needle', { dateKey })
    return existing
  }
  const fallback = buildFallbackNeedle(qualifying)
  const text = ai?.text ?? fallback.text
  const textNormie = ai?.textNormie ?? fallback.textNormie

  const data: NeedleData = {
    text,
    textNormie,
    dateKey,
    repoCount: qualifying.length,
    generatedAt: new Date().toISOString(),
    source: ai ? 'ai' : 'fallback',
  }

  await redis.set(needleRedisKey(dateKey), data, { ex: NEEDLE_TTL_SEC })
  await indexArchiveDate(NEEDLE_DATES_INDEX_KEY, dateKey)
  return data
}

/** Fire-and-forget refresh after a rescore so The Needle stays current intraday. */
export function refreshNeedleAfterRescore(): void {
  void generateAndCacheNeedle({ force: true }).catch(err => {
    console.error('[needle] post-rescore refresh failed', err)
  })
}

async function readCachedNeedle(dateKey: string): Promise<NeedleData | null> {
  const redis = getRedis()
  return redis.get<NeedleData>(needleRedisKey(dateKey))
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
