import { generateTextGeminiOnly, hasGeminiApiKey } from '@/lib/llm'
import { NORMIE_TEMPERATURE, normieVoiceGuidance } from '@/lib/normieVoice'
import { stripMarkdown } from '@/lib/textCleanup'
import type { Repo, RubricRow, Score } from '@/lib/scores'

type SourceItem = { key: string; label: string; source: string }

function collectSourceItems(repo: Repo): SourceItem[] {
  const items: SourceItem[] = []
  const pushScore = (prefix: string, score: Score | null | undefined) => {
    if (!score?.rubric?.length) return
    for (let i = 0; i < score.rubric.length; i++) {
      const row = score.rubric[i]
      if (!row.source?.trim()) continue
      items.push({
        key: `${prefix}:${i}:${row.label}`,
        label: row.label,
        source: row.source.trim(),
      })
    }
  }
  pushScore('sl', repo.shippingLeverage)
  pushScore('tm', repo.tokenMechanic)
  pushScore('bi', repo.builderIntegrity)
  return items
}

function applyNormieMap(
  score: Score | null | undefined,
  prefix: string,
  byKey: Map<string, string>,
): Score | null | undefined {
  if (!score) return score
  return {
    ...score,
    rubric: score.rubric.map((row, i) => {
      const key = `${prefix}:${i}:${row.label}`
      const sourceNormie = byKey.get(key)
      if (!sourceNormie) return row
      return { ...row, sourceNormie }
    }),
  }
}

function parseNormieMap(raw: string, items: SourceItem[]): Map<string, string> {
  const map = new Map<string, string>()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return map
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    for (const item of items) {
      const val = parsed[item.key]
      if (typeof val !== 'string' || !val.trim()) continue
      map.set(item.key, stripMarkdown(val).slice(0, 600))
    }
  } catch {
    // ignore — leave technical sources only
  }
  return map
}

/**
 * Attach Gemini-only plain-English rewrites of rubric `source` notes.
 * Never uses Anthropic. No-ops if Gemini is unset or translation fails.
 * Call only on newly scored repos (not a backfill).
 */
export async function attachRubricSourceNormies(repo: Repo): Promise<Repo> {
  if (!hasGeminiApiKey()) return repo

  const items = collectSourceItems(repo)
  if (!items.length) return repo

  const listBlock = items
    .map(
      (it, n) =>
        `${n + 1}. key=${JSON.stringify(it.key)}\n   row=${JSON.stringify(it.label)}\n   source=${JSON.stringify(it.source)}`,
    )
    .join('\n')

  const prompt = `Rewrite each rubric "source" note into plain English for token holders who are not developers. Keep the same facts; warmer and simpler. Do not change scores or invent evidence.

${normieVoiceGuidance('verdict')}

INPUT ROWS:
${listBlock}

Return ONLY a JSON object mapping each key to its plain-English rewrite (same keys). Example shape:
{"bi:0:On-chain commitments and constraints":"…","tm:1:…":"…"}`

  try {
    const { text } = await generateTextGeminiOnly({
      prompt,
      maxTokens: 2500,
      temperature: NORMIE_TEMPERATURE,
      label: 'rubric-source-normie',
    })
    const byKey = parseNormieMap(text, items)
    if (!byKey.size) return repo

    return {
      ...repo,
      shippingLeverage: applyNormieMap(repo.shippingLeverage, 'sl', byKey) as Score | null | undefined,
      tokenMechanic: applyNormieMap(repo.tokenMechanic, 'tm', byKey) as Score | null,
      builderIntegrity: applyNormieMap(repo.builderIntegrity, 'bi', byKey) as Score,
    }
  } catch (err) {
    console.warn('[rubric-source-normie] Gemini translate failed; keeping technical sources', {
      slug: repo.githubSlug,
      err,
    })
    return repo
  }
}

/** Preserve sourceNormie when a row is copied/relabeled. */
export function copySourceNormie(from: RubricRow, to: RubricRow): RubricRow {
  if (!from.sourceNormie?.trim()) return to
  return { ...to, sourceNormie: from.sourceNormie }
}
