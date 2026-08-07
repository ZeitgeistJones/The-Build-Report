import { generateText, generateTextGeminiOnly, hasGeminiApiKey, hasLlmApiKey } from '@/lib/llm'
import { shortenSourceForNormieDisplay } from '@/lib/normieSourceDisplay'
import { NORMIE_TEMPERATURE, normieVoiceGuidance } from '@/lib/normieVoice'
import type { Repo, RubricRow, Score } from '@/lib/scores'

type SourceItem = { key: string; label: string; source: string }

/** Long, copy-pasted, or jargon-heavy PE notes — regenerate or clip. */
export function isStaleSourceNormie(source: string, sourceNormie?: string | null): boolean {
  const n = sourceNormie?.trim()
  if (!n) return true
  if (n.length > 300) return true
  const s = source.trim()
  if (s && n.slice(0, 72) === s.slice(0, 72)) return true
  // Technical leftovers that slipped through older prompts
  if (
    /\b(lean\s*4|r1cs|calldata|stdlib|axiom|circom|halo2|zk\.golf|orchestration|pty)\b/i.test(n) &&
    !/\b(math proofs|computer checks|outside contest|no money at risk)\b/i.test(n)
  ) {
    return true
  }
  return false
}

function collectSourceItems(repo: Repo, onlyStale = false): SourceItem[] {
  const items: SourceItem[] = []
  const pushScore = (prefix: string, score: Score | null | undefined) => {
    if (!score?.rubric?.length) return
    for (let i = 0; i < score.rubric.length; i++) {
      const row = score.rubric[i]
      if (!row.source?.trim()) continue
      if (onlyStale && !isStaleSourceNormie(row.source, row.sourceNormie)) continue
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

function fillMissingSourceNormies(score: Score | null | undefined): Score | null | undefined {
  if (!score?.rubric?.length) return score
  return {
    ...score,
    rubric: score.rubric.map(row => {
      if (!row.source?.trim()) return row
      if (!isStaleSourceNormie(row.source, row.sourceNormie)) return row
      return { ...row, sourceNormie: shortenSourceForNormieDisplay(row.source) }
    }),
  }
}

/** Fill any missing sourceNormie with a short readable clip (sync, no LLM). */
export function ensureSourceNormieClips(repo: Repo): Repo {
  return {
    ...repo,
    shippingLeverage: fillMissingSourceNormies(repo.shippingLeverage) as Score | null | undefined,
    tokenMechanic: fillMissingSourceNormies(repo.tokenMechanic) as Score | null,
    builderIntegrity: fillMissingSourceNormies(repo.builderIntegrity) as Score,
  }
}

/** Exported for tests. */
export function parseNormieMaps(
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
    const short = shortenSourceForNormieDisplay(rawVal)
    if (!short) continue

    const k = rawKey.trim()
    if (keySet.has(k)) {
      byKey.set(k, short)
      continue
    }
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

async function rewriteSourcesWithLlm(
  prompt: string,
): Promise<{ text: string; provider: string } | null> {
  // Prefer Gemini so Haiku quota stays on scoring; fall back to any configured LLM.
  if (hasGeminiApiKey()) {
    try {
      return await generateTextGeminiOnly({
        prompt,
        maxTokens: 900,
        temperature: NORMIE_TEMPERATURE,
        label: 'rubric-source-normie',
      })
    } catch (err) {
      console.warn('[rubric-source-normie] Gemini failed; trying other LLM', err)
    }
  }
  if (!hasLlmApiKey()) return null
  try {
    return await generateText({
      prompt,
      maxTokens: 900,
      temperature: NORMIE_TEMPERATURE,
      label: 'rubric-source-normie',
    })
  } catch (err) {
    console.warn('[rubric-source-normie] LLM rewrite failed', err)
    return null
  }
}

/**
 * Attach plain-English rewrites of rubric `source` notes.
 * Tries Gemini, then Anthropic; always fills gaps with a short clip so Plain English
 * mode never shows empty after a new score.
 * @param onlyStale — rewrite only long/jargony/missing notes (cheaper backfill).
 */
export async function attachRubricSourceNormies(
  repo: Repo,
  opts?: { onlyStale?: boolean },
): Promise<Repo> {
  const items = collectSourceItems(repo, opts?.onlyStale === true)
  if (!items.length) return ensureSourceNormieClips(repo)

  let working: Repo = repo

  if (hasLlmApiKey()) {
    const listBlock = items
      .map(
        it =>
          `- key "${it.key}" | row "${it.label}"\n  technical: ${JSON.stringify(it.source)}`,
      )
      .join('\n')

    const prompt = `You rewrite scorecard "why this score" notes for $CLAWD token holders who are not developers.

${normieVoiceGuidance('rubricSource')}

For EACH input row, write a Plain English rewrite:
- 1–2 short sentences only. Target ~35–50 words (about 25–30% shorter than a typical technical note).
- Cover the gist only: what this repo is, and why this row scored how it did. Do NOT list file names, APIs, toolchains, or every proof detail.
- Everyday words only. Forbidden unless you gloss in plain words: Lean, R1CS, ZK circuit jargon, CI, RPC, stdlib, DSL, axiom, calldata, PTY, orchestration, rubric.
- Same facts — do not invent evidence or change the score meaning.
- Keep the repo name if the technical note names it.

INPUT:
${listBlock}

Return ONLY JSON mapping each key to its rewrite. Keys must be exactly: ${items.map(i => i.key).join(', ')}
Example: {"sl0":"clawd-zk-golf is a one-day contest entry for fancy math proofs — not a tool other CLAWD builders plug into. It doesn't help ship apps that burn or lock tokens, so shipping-leverage stays low."}`

    const result = await rewriteSourcesWithLlm(prompt)
    if (result) {
      const { byKey, byLabel } = parseNormieMaps(result.text, items)
      if (byKey.size) {
        console.log('[rubric-source-normie] attached', {
          slug: repo.githubSlug,
          provider: result.provider,
          mapped: byKey.size,
          expected: items.length,
        })
        working = {
          ...repo,
          shippingLeverage: applyNormieMap(repo.shippingLeverage, 'sl', byKey, byLabel) as
            | Score
            | null
            | undefined,
          tokenMechanic: applyNormieMap(repo.tokenMechanic, 'tm', byKey, byLabel) as Score | null,
          builderIntegrity: applyNormieMap(repo.builderIntegrity, 'bi', byKey, byLabel) as Score,
        }
      } else {
        console.warn('[rubric-source-normie] LLM returned no usable keys; filling short clips', {
          slug: repo.githubSlug,
          provider: result.provider,
          preview: result.text.slice(0, 240),
        })
      }
    }
  } else {
    console.warn('[rubric-source-normie] no LLM key; using short clips', { slug: repo.githubSlug })
  }

  return ensureSourceNormieClips(working)
}

/** Preserve sourceNormie when a row is copied/relabeled. */
export function copySourceNormie(from: RubricRow, to: RubricRow): RubricRow {
  if (!from.sourceNormie?.trim()) return to
  return { ...to, sourceNormie: from.sourceNormie }
}
