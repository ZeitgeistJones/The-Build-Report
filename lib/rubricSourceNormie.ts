import { generateTextGeminiOnly, hasGeminiApiKey } from '@/lib/llm'
import { NORMIE_TEMPERATURE } from '@/lib/normieVoice'
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
        // Short stable keys — models rewrite long label-based keys and break matching.
        key: `${prefix}${i}`,
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
  byLabel: Map<string, string>,
): Score | null | undefined {
  if (!score) return score
  return {
    ...score,
    rubric: score.rubric.map((row, i) => {
      const sourceNormie = byKey.get(`${prefix}${i}`) || byLabel.get(row.label.toLowerCase())
      if (!sourceNormie) return row
      return { ...row, sourceNormie }
    }),
  }
}

function shortenNormie(text: string): string {
  const cleaned = stripMarkdown(text).replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  // Prefer first 1–2 sentences.
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  const clipped = parts.slice(0, 2).join(' ')
  return clipped.length > 280 ? `${clipped.slice(0, 277).trim()}…` : clipped
}

function parseNormieMaps(
  raw: string,
  items: SourceItem[],
): { byKey: Map<string, string>; byLabel: Map<string, string> } {
  const byKey = new Map<string, string>()
  const byLabel = new Map<string, string>()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return { byKey, byLabel }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return { byKey, byLabel }
  }

  const keySet = new Set(items.map(i => i.key))
  const labelToKey = new Map(items.map(i => [i.label.toLowerCase(), i.key]))

  for (const [rawKey, rawVal] of Object.entries(parsed)) {
    if (typeof rawVal !== 'string' || !rawVal.trim()) continue
    const short = shortenNormie(rawVal)
    if (!short) continue

    const k = rawKey.trim()
    if (keySet.has(k)) {
      byKey.set(k, short)
      continue
    }
    // Model sometimes returns "bi0" with spaces or the row label as key.
    const compact = k.replace(/\s+/g, '')
    if (keySet.has(compact)) {
      byKey.set(compact, short)
      continue
    }
    const byLbl = labelToKey.get(k.toLowerCase())
    if (byLbl) {
      byKey.set(byLbl, short)
      byLabel.set(k.toLowerCase(), short)
    }
  }

  return { byKey, byLabel }
}

/**
 * Attach Gemini-only plain-English rewrites of rubric `source` notes.
 * Never uses Anthropic. No-ops if Gemini is unset or translation fails.
 * Call only on newly scored repos (not a backfill).
 */
export async function attachRubricSourceNormies(repo: Repo): Promise<Repo> {
  if (!hasGeminiApiKey()) {
    console.warn('[rubric-source-normie] GEMINI_API_KEY unset; skipping sourceNormie', {
      slug: repo.githubSlug,
    })
    return repo
  }

  const items = collectSourceItems(repo)
  if (!items.length) return repo

  const listBlock = items
    .map(
      it =>
        `- key "${it.key}" | row "${it.label}"\n  technical: ${JSON.stringify(it.source)}`,
    )
    .join('\n')

  const prompt = `You rewrite scorecard "why this score" notes for $CLAWD token holders who are not developers.

For EACH input row, write a plain-English rewrite that is MUCH SHORTER than the technical note:
- Exactly 1 or 2 short sentences (never 3+).
- No jargon (no CI, stdlib, lockfile, RPC, toolchain, rubric). Soften with everyday words.
- Same facts only — do not invent evidence or change the score meaning.
- Keep the repo name if the technical note names it.

INPUT:
${listBlock}

Return ONLY JSON mapping each key to its short rewrite. Keys must be exactly: ${items.map(i => i.key).join(', ')}
Example: {"sl0":"One short sentence.","bi2":"Another short sentence."}`

  try {
    const { text } = await generateTextGeminiOnly({
      prompt,
      maxTokens: 1200,
      temperature: 0.4,
      label: 'rubric-source-normie',
    })
    const { byKey, byLabel } = parseNormieMaps(text, items)
    if (!byKey.size) {
      console.warn('[rubric-source-normie] Gemini returned no usable keys', {
        slug: repo.githubSlug,
        preview: text.slice(0, 240),
      })
      return repo
    }

    console.log('[rubric-source-normie] attached', {
      slug: repo.githubSlug,
      mapped: byKey.size,
      expected: items.length,
    })

    return {
      ...repo,
      shippingLeverage: applyNormieMap(repo.shippingLeverage, 'sl', byKey, byLabel) as
        | Score
        | null
        | undefined,
      tokenMechanic: applyNormieMap(repo.tokenMechanic, 'tm', byKey, byLabel) as Score | null,
      builderIntegrity: applyNormieMap(repo.builderIntegrity, 'bi', byKey, byLabel) as Score,
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
