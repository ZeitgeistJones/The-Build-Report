import Anthropic from '@anthropic-ai/sdk'
import { getRedis } from '@/lib/redis'
import { getSlugsRescoredBetween } from '@/lib/scoreHistory'
import { getRescoreSummaries, type RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import { REPOS } from '@/lib/scores'
import { stripMarkdown } from '@/lib/textCleanup'
import { normieVoiceGuidance } from '@/lib/normieVoice'
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

async function generateNeedleCopy(
  qualifying: QualifyingMove[],
): Promise<{ text: string; textNormie?: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const lines = formatMoveLines(qualifying)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You write a very short daily column called "The Needle" for a crypto ecosystem scoring site. It reports on today's rescores — sometimes the overall grade moved, sometimes it held flat even though specific rubric rows changed underneath. Here is today's rescore data:

${lines}

Write 2-3 sentences total, no more. Pick the single most interesting thing that happened — this could be an overall grade move, OR a specific rubric row that improved/declined even though the overall grade held flat. If nothing moved overall, explain specifically what DID change at the rubric level and why it wasn't enough to shift the letter grade or percentage yet. Be specific — name the actual thing that changed (a security audit, a new test, a dependency, whatever the rescore notes mention), not just "held steady." Casual, direct, no fluff, no headers, no bullet points. Just plain prose.

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "text": "2-3 sentences following the instructions above.",
  "textNormie": "Same facts and repo names as text, rewritten for someone who knows nothing about code or crypto."
}

NORMIE VOICE GUIDE (applies to textNormie only):
${normieVoiceGuidance('needle')}
`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content
      .map(block => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()
    if (!raw) return null

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as { text?: string; textNormie?: string }
    const text = typeof parsed.text === 'string' ? stripMarkdown(parsed.text).trim() : ''
    if (!text) return null
    const textNormie =
      typeof parsed.textNormie === 'string' ? stripMarkdown(parsed.textNormie).trim() : ''
    return textNormie ? { text, textNormie } : { text }
  } catch (err) {
    console.error('[needle] AI generation failed', err)
    return null
  }
}

export type GenerateNeedleOptions = {
  /** Defaults to today Mountain — use yesterdayMountainDateKey() from daily-digest cron for brief sync. */
  dateKey?: string
}

export async function generateAndCacheNeedle(
  options: GenerateNeedleOptions = {},
): Promise<NeedleData | null> {
  const redis = getRedis()
  const dateKey = options.dateKey ?? dateKeyMountain()
  const { startMs, endMs } = mountainDateKeyBoundsMs(dateKey)
  const slugs = await getSlugsRescoredBetween(startMs, endMs)
  if (!slugs.length) return null

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

  if (!qualifying.length) return null

  const ai = await generateNeedleCopy(qualifying)
  const fallback = buildFallbackNeedle(qualifying)
  const text = ai?.text ?? fallback.text
  const textNormie = ai?.textNormie ?? fallback.textNormie

  const data: NeedleData = {
    text,
    textNormie,
    dateKey,
    repoCount: qualifying.length,
    generatedAt: new Date().toISOString(),
  }

  await redis.set(needleRedisKey(dateKey), data, { ex: NEEDLE_TTL_SEC })
  await indexArchiveDate(NEEDLE_DATES_INDEX_KEY, dateKey)
  return data
}

/** Fire-and-forget refresh after a rescore so The Needle stays current intraday. */
export function refreshNeedleAfterRescore(): void {
  void generateAndCacheNeedle().catch(err => {
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
      if (cached) {
        // #region agent log
        fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',location:'lib/needle.ts:getNeedle',message:'needle cache hit',data:{cacheKey:key,dateKey:cached.dateKey,repoCount:cached.repoCount,readKeys:keys},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        console.log('[needle-cache]', JSON.stringify({
          event: 'hit',
          cacheKey: key,
          dateKey: cached.dateKey,
          repoCount: cached.repoCount,
        }))
        // #endregion
        return cached
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',location:'lib/needle.ts:getNeedle',message:'needle missing',data:{readKeys:keys},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    console.log('[needle-cache]', JSON.stringify({ event: 'miss', readKeys: keys }))
    // #endregion
    return null
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',location:'lib/needle.ts:getNeedle',message:'needle read error',data:{error:err instanceof Error?err.message:String(err)},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return null
  }
}
