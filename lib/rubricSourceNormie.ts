import { appendFileSync } from 'fs'
import { join } from 'path'
import { generateTextGeminiOnly, hasGeminiApiKey } from '@/lib/llm'
import { shortenSourceForNormieDisplay } from '@/lib/normieSourceDisplay'
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

function fillMissingSourceNormies(score: Score | null | undefined): Score | null | undefined {
  if (!score?.rubric?.length) return score
  return {
    ...score,
    rubric: score.rubric.map(row => {
      if (row.sourceNormie?.trim() || !row.source?.trim()) return row
      return { ...row, sourceNormie: shortenSourceForNormieDisplay(row.source) }
    }),
  }
}

function applyFilled(repo: Repo): Repo {
  return {
    ...repo,
    shippingLeverage: fillMissingSourceNormies(repo.shippingLeverage) as Score | null | undefined,
    tokenMechanic: fillMissingSourceNormies(repo.tokenMechanic) as Score | null,
    builderIntegrity: fillMissingSourceNormies(repo.builderIntegrity) as Score,
  }
}

function countSourceNormies(repo: Repo): number {
  let n = 0
  for (const score of [repo.shippingLeverage, repo.tokenMechanic, repo.builderIntegrity]) {
    if (!score?.rubric) continue
    for (const row of score.rubric) {
      if (row.sourceNormie?.trim()) n++
    }
  }
  return n
}

// #region agent log
function agentLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) {
  const payload = {
    sessionId: 'ba045f',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
    runId: 'source-normie-debug',
  }
  fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ba045f' },
    body: JSON.stringify(payload),
  }).catch(() => {})
  try {
    appendFileSync(join(process.cwd(), 'debug-ba045f.log'), `${JSON.stringify(payload)}\n`)
  } catch {
    // non-fatal in serverless
  }
}
// #endregion

/** Exported for debug scripts / tests. */
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
 * Attach plain-English rewrites of rubric `source` notes.
 * Tries Gemini first; always fills gaps with a deterministic short clip so Plain English
 * mode never shows empty / "not yet" after a new score.
 * Call only on newly scored repos (not a backfill).
 */
export async function attachRubricSourceNormies(repo: Repo): Promise<Repo> {
  const items = collectSourceItems(repo)
  const geminiOk = hasGeminiApiKey()

  // #region agent log
  agentLog('A', 'rubricSourceNormie.ts:attach', 'attach entry', {
    slug: repo.githubSlug,
    itemCount: items.length,
    hasGemini: geminiOk,
    existingNormies: countSourceNormies(repo),
  })
  // #endregion

  if (!items.length) return repo

  let working: Repo = repo
  let geminiMapped = 0
  let geminiPath: 'skipped-no-key' | 'ok' | 'empty-parse' | 'error' = geminiOk
    ? 'ok'
    : 'skipped-no-key'

  if (!geminiOk) {
    console.warn('[rubric-source-normie] GEMINI_API_KEY unset; using deterministic short clips', {
      slug: repo.githubSlug,
    })
    // #region agent log
    agentLog('A', 'rubricSourceNormie.ts:no-gemini', 'gemini unset — fallback fill', {
      slug: repo.githubSlug,
    })
    // #endregion
  } else {
    const listBlock = items
      .map(
        it =>
          `- key "${it.key}" | row "${it.label}"\n  technical: ${JSON.stringify(it.source)}`,
      )
      .join('\n')

    const prompt = `You rewrite scorecard "why this score" notes for $CLAWD token holders who are not developers.

For EACH input row, write a plain-English rewrite that is MUCH SHORTER than the technical note:
- Prefer ONE short sentence. Two only if needed. Never three.
- Aim under ~25 words.
- No jargon (no CI, stdlib, lockfile, RPC, toolchain, rubric, whisper.cpp, Ollama). Soften with everyday words.
- Same facts only — do not invent evidence or change the score meaning.
- Keep the repo name if the technical note names it.

INPUT:
${listBlock}

Return ONLY JSON mapping each key to its short rewrite. Keys must be exactly: ${items.map(i => i.key).join(', ')}
Example: {"sl0":"This tool helps the builder ship wallet features faster.","bi2":"Docs are clear; testing is still thin."}`

    try {
      const { text } = await generateTextGeminiOnly({
        prompt,
        maxTokens: 1200,
        temperature: 0.4,
        label: 'rubric-source-normie',
      })
      const { byKey, byLabel } = parseNormieMaps(text, items)
      geminiMapped = byKey.size
      if (!byKey.size) {
        geminiPath = 'empty-parse'
        console.warn('[rubric-source-normie] Gemini returned no usable keys; filling short clips', {
          slug: repo.githubSlug,
          preview: text.slice(0, 240),
        })
        // #region agent log
        agentLog('B', 'rubricSourceNormie.ts:empty-parse', 'gemini parse empty', {
          slug: repo.githubSlug,
          preview: text.slice(0, 240),
        })
        // #endregion
      } else {
        console.log('[rubric-source-normie] attached', {
          slug: repo.githubSlug,
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
        // #region agent log
        agentLog('B', 'rubricSourceNormie.ts:gemini-ok', 'gemini mapped keys', {
          slug: repo.githubSlug,
          mapped: byKey.size,
          expected: items.length,
        })
        // #endregion
      }
    } catch (err) {
      geminiPath = 'error'
      console.warn('[rubric-source-normie] Gemini translate failed; filling short clips', {
        slug: repo.githubSlug,
        err,
      })
      // #region agent log
      agentLog('B', 'rubricSourceNormie.ts:gemini-err', 'gemini threw', {
        slug: repo.githubSlug,
        err: err instanceof Error ? err.message : String(err),
      })
      // #endregion
    }
  }

  const filled = applyFilled(working)
  const afterCount = countSourceNormies(filled)

  // #region agent log
  agentLog('E', 'rubricSourceNormie.ts:exit', 'attach exit after fallback fill', {
    slug: repo.githubSlug,
    geminiPath,
    geminiMapped,
    itemCount: items.length,
    sourceNormieCount: afterCount,
  })
  // #endregion

  return filled
}

/** Preserve sourceNormie when a row is copied/relabeled. */
export function copySourceNormie(from: RubricRow, to: RubricRow): RubricRow {
  if (!from.sourceNormie?.trim()) return to
  return { ...to, sourceNormie: from.sourceNormie }
}
