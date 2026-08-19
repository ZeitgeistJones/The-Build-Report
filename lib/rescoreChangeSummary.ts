import { generateText, hasLlmApiKey } from './llm'
import { Repo, Score } from './scores'
import { getShippingLeverage, getTokenMechanicForDisplay } from './economicGrade'
import { stripMarkdown } from './textCleanup'
import { normieVoiceGuidance } from './normieVoice'
import { buildNormieWhatChangedBlurb, plainWorkFromCommitMessages } from './rescoreSummaries'
import {
  computeRescoreDeltas,
  formatChangedRowsForPrompt,
  formatRescoreDeltaHeader,
  type RescoreAggregateDelta,
} from './rescoreDeltas'

export type RescoreEvidenceForSummary = {
  rootFiles: string[]
  readmeExcerpt: string | null
}

function formatScoreBlock(label: string, score: Score | null): string {
  if (!score) return `${label}: N/A`
  const rows = score.rubric
    .map(r => `  - ${r.label} (${r.weight}): ${r.level} [${r.source}]`)
    .join('\n')
  return `${label}: ${score.letter} (${score.pct}%)\n${rows}`
}

function formatEconomicBlock(repo: Repo): string {
  const shipping = getShippingLeverage(repo)
  if (shipping) return formatScoreBlock('Shipping leverage', shipping)
  return formatScoreBlock('Holder economics', getTokenMechanicForDisplay(repo))
}

function formatRepoScores(repo: Repo): string {
  return [
    `Tag: ${repo.tag} · Status: ${repo.status}`,
    formatEconomicBlock(repo),
    formatScoreBlock('Builder standards', repo.builderIntegrity),
    `Verdict: ${repo.verdict}`,
  ].join('\n')
}

function formatEvidenceBlock(evidence?: RescoreEvidenceForSummary | null): string {
  if (!evidence) return ''
  const roots = evidence.rootFiles.length ? evidence.rootFiles.join(', ') : 'none'
  const lines = [`REPO EVIDENCE AT RESCORE (supporting context — commits above are primary for the blurb):`, `Root files: ${roots}`]
  if (evidence.readmeExcerpt?.trim()) {
    lines.push('README excerpt:')
    lines.push('"""')
    lines.push(evidence.readmeExcerpt.trim().slice(0, 1200))
    lines.push('"""')
  }
  return lines.join('\n') + '\n\n'
}

function summaryContradictsDeltas(text: string, deltas: RescoreAggregateDelta): boolean {
  const lower = text.toLowerCase()
  const econ = deltas.economic.deltaPct
  const bi = deltas.builderIntegrity.deltaPct

  // Mixed axes (one up, one down) — a good blurb often says "stronger" AND "dipped".
  // The old global rising/falling detector false-rejected those and forced the fallback.
  if (
    econ != null &&
    bi != null &&
    econ !== 0 &&
    bi !== 0 &&
    Math.sign(econ) !== Math.sign(bi)
  ) {
    return false
  }

  const rising =
    /\b(should rise|will rise|bump(ed)? up|increase(d)?|improv(ed|e)|stronger|higher)\b/.test(lower)
  const falling =
    /\b(should fall|drop(ped)?|decrease(d)?|lower|weaker|declin(ed|e))\b/.test(lower)

  if (bi != null && bi < 0 && rising && !falling) return true
  if (bi != null && bi > 0 && falling && !rising) return true
  if (econ != null && econ < 0 && rising && !falling) return true
  if (econ != null && econ > 0 && falling && !rising) return true
  return false
}

/** Invented "we scored an older snapshot / before these commits" excuses — false for a live rescore. */
function summaryClaimsStaleSnapshot(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    /\b(scoring snapshot|scored (state|before)|before (these|the) (substantive )?commits were added|before these substantive commits|prior to (these|the) commits|outdated (score|snapshot))\b/.test(
      lower,
    ) ||
    /\b(re-?evaluat(e|ed|ion) in the next|should be re-?(scored|evaluated) (in|on) the next)\b/.test(lower)
  )
}

/**
 * Invented "README/root haven't caught up / docs missing" stories — common when the model
 * overweights commit messages vs the live evidence already used for NEW SCORES.
 */
export function summaryClaimsMissingDocs(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    /\b(have not yet caught up|has not yet caught up|haven't caught up|hasn't caught up|have not caught up|has not caught up)\b/.test(
      lower,
    ) ||
    /\b(not yet (reflected|documented|caught up|visible)|aren't visible in the root|are not visible in the root|not visible in the root)\b/.test(
      lower,
    ) ||
    /\b(root tree .{0,40}(not|haven't|hasn't|missing)|readme .{0,40}(and|&) root .{0,60}(not|haven't|hasn't|missing|caught))\b/.test(
      lower,
    ) ||
    /\b(leaving .{0,100}undocumented|docs? (are|is|remain) (missing|absent|outdated|behind|incomplete)|documentation (has|have) not)\b/.test(
      lower,
    )
  )
}

/** When evidence is present, reject claims that a listed root file is missing. */
function summaryDeniesListedRootFiles(
  text: string,
  evidence?: RescoreEvidenceForSummary | null,
): boolean {
  if (!evidence?.rootFiles.length) return false
  const lower = text.toLowerCase()
  const notable = evidence.rootFiles.filter(f =>
    /\.(md|txt)$/i.test(f) || /^(readme|architecture|plan|tests?|adapters?|tools?)$/i.test(f),
  )
  for (const name of notable) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const missingClaim = new RegExp(
      `\\b${escaped}\\b.{0,40}\\b(missing|absent|not (in|on) (the )?root|aren't visible|are not visible|not visible)\\b|\\b(missing|absent|not (in|on) (the )?root|aren't visible|are not visible|not visible).{0,40}\\b${escaped}\\b`,
      'i',
    )
    if (missingClaim.test(lower)) return true
  }
  return false
}

/**
 * "Rose 7 pts because governance moved low→mid" — restates the delta/header as the reason.
 * Evidence must explain the new level; the row transition is already shown above.
 */
export function summaryIsCircularRestatement(text: string): boolean {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()

    // "Role in ecosystem workflow row was moved to low because…" — mechanism as reason.
    if (
      /\b(role in ecosystem workflow|multiplies builder shipping capacity|downstream path to holder value|on-chain commitments and constraints|user funds, risk, and safety posture|transparency and verifiability|governance, token-economics, and ecosystem alignment|security, testing, and cryptographic rigor|builder standards|shipping leverage|holder economics)\b/.test(
        lower,
      ) &&
      /\b(was )?moved (from|to)\s+(low|mid|high|n\/?a)\b/.test(lower) &&
      /\b(because|as|after|when)\b/.test(lower)
    ) {
      return true
    }

    const restatesMove =
      /\b(rose|fell|increased|decreased|climbed|dropped)\s+\d+\s*pts?\b/.test(lower) ||
      /\b(rose|fell)\s+to\s+[a-f][+\-]?\b/.test(lower) ||
      /\b[+\-]\d+\s*pts?\b/.test(lower) ||
      /\b(was )?moved (from|to)\s+(low|mid|high|n\/?a)\b/.test(lower)

    if (!restatesMove) continue

    // Circular: “… rose N pts because/as governance moved low→mid”
    const reasonMatch = lower.match(/\b(because|as|after|when)\b(.{0,220})/)
    if (reasonMatch) {
      const reasonClause = reasonMatch[2]
      const explainsViaLevel =
        /\b(moved from|went from|moved to)\s+(low|mid|high|n\/?a)\b/.test(reasonClause) ||
        /\b(low|mid|high|n\/?a)\s*(→|->|to)\s*(low|mid|high|n\/?a)\b/.test(reasonClause)
      if (explainsViaLevel) {
        // Strip level-transition + axis/row name boilerplate; leftover should still have evidence.
        const stripped = reasonClause
          .replace(
            /\b(moved from|went from|moved to)\s+(low|mid|high|n\/?a)(\s+(to|→|->)\s+(low|mid|high|n\/?a))?\b/g,
            ' ',
          )
          .replace(/\b(low|mid|high|n\/?a)\s*(→|->|to)\s*(low|mid|high|n\/?a)\b/g, ' ')
          .replace(
            /\b(governance|token-economics|ecosystem alignment|builder standards|shipping leverage|holder economics|multiplies builder shipping capacity|downstream path to holder value|role in ecosystem workflow|on-chain commitments and constraints|user funds, risk, and safety posture|transparency and verifiability|security, testing, and cryptographic rigor)\b/gi,
            ' ',
          )
          .replace(/[:;—]+/g, ' ')
          .trim()

        const primary = (stripped.split(/\b(while|which|though|although|but|and so)\b/)[0] ?? '').trim()
        if (primary.length < 28) return true
      }
    }

    // Circular: sentence is basically only the ±N pts / letter restatement (no evidence nouns).
    const withoutMoveBoilerplate = lower
      .replace(/\b(rose|fell|increased|decreased|climbed|dropped)\s+\d+\s*pts?\b/g, ' ')
      .replace(/\b(rose|fell)\s+to\s+[a-f][+\-]?\b/g, ' ')
      .replace(/\b[+\-]\d+\s*pts?\b/g, ' ')
      .replace(/\b(was )?moved (from|to)\s+(low|mid|high|n\/?a)\b/g, ' ')
      .replace(
        /\b(builder standards|shipping leverage|holder economics|overall|grade|score|the|a|an|to|from|on|in|and|this|rescore|row)\b/g,
        ' ',
      )
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (withoutMoveBoilerplate.length < 20) return true
  }
  return false
}

/** Soft length gate — prompt asks 1–2 sentences; walls get rejected. */
export function summaryTooLong(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
  if (sentences.length > 2) return true
  if (trimmed.length > 480) return true
  const words = trimmed.split(/\s+/).filter(Boolean).length
  return words > 110
}

/**
 * Normie blurb still reading like a scorecard sermon — reject so PE fallback can lead with work.
 * Keep this narrow so we don't kick decent friend-voice blurbs into worse commit dumps.
 */
export function summaryNotNormieEnough(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    /\b(rubric|token mechanic|shipping leverage|holder economics|workflow row|builder standards \+\d)\b/i.test(lower) ||
    /\b(was )?moved (from|to)\s+(low|mid|high)\b/.test(lower) ||
    /\b(role in ecosystem workflow|multiplies builder shipping capacity|downstream path to holder value)\b/.test(
      lower,
    ) ||
    /~\//.test(text) ||
    /\bTCC\b/.test(text) ||
    /\b(per-VM|in-guest|login dir|subscription POOL|fleet-health|claude-process)\b/i.test(lower) ||
    /\bPOOL\s*\(org\)/i.test(text) ||
    /\bsemantic vad\b|\bcustom-voice gating\b/i.test(lower)
  )
}

/**
 * Shipping-leverage drop narrated as if recent pushes caused the downgrade —
 * contradicts Role High = active use with recent pushes; busy ≠ in the shipping path.
 */
export function summaryBlamesPushCadenceForDrop(text: string): boolean {
  const lower = text.toLowerCase()
  const citesPush =
    /\b(active push|push cadence|recent pushes|pushed (today|yesterday)|last push)\b/.test(lower)
  if (!citesPush) return false
  return (
    /\b(moved to low|fell|drop(ped)?|downgrade|not (yet )?a multiplier|do not ground|don't ground|unclear adoption)\b/.test(
      lower,
    ) || /\bbecause\b.{0,80}\b(push|pushes|cadence)\b/.test(lower)
  )
}

function fallbackFlatSummary(deltas: RescoreAggregateDelta, commitMessages: string[] = []): string {
  const work = plainWorkFromCommitMessages(commitMessages)
  const bothFlat = deltas.economic.label === 'flat' && deltas.builderIntegrity.label === 'flat'
  const econ = deltas.economic.deltaPct
  const bi = deltas.builderIntegrity.deltaPct
  const rose =
    (econ != null && econ > 0) || (bi != null && bi > 0)
  const fell =
    (econ != null && econ < 0) || (bi != null && bi < 0)

  if (bothFlat) {
    return work
      ? `Recent work covered ${work}, but that did not change how this project reads on the live scorecard yet.`
      : 'The score stayed the same — recent commits did not change how this project reads on the scorecard yet.'
  }

  if (work) {
    if (rose && !fell) {
      return `Recent work covered ${work}. The live reading moved up as shown above on a fuller take of how that work fits this repo.`
    }
    if (fell && !rose) {
      return `Recent work covered ${work}. The live reading moved down as shown above on a stricter take of what is actually in the repo today.`
    }
    return `Recent work covered ${work}. The live reading moved as shown above.`
  }

  if (fell && !rose) {
    return 'The score moved down as shown above on a stricter reading of what is in the repo today versus those recent commits.'
  }
  if (rose && !fell) {
    return 'The score moved up as shown above on a fuller reading of what recent commits put in the repo.'
  }
  return 'The score moved as shown above. Recent commits do not always move every scorecard row yet.'
}

/**
 * Plain-English fallback for the "What changed" blurb — used when the LLM output
 * is missing or rejected. Leads with what landed (commits), then a soft score note.
 */
function fallbackNormieSummary(
  repoName: string,
  deltas: RescoreAggregateDelta,
  commitMessages: string[] = [],
): string {
  return buildNormieWhatChangedBlurb({
    repoName,
    economicDeltaPct: deltas.economic.deltaPct,
    builderDeltaPct: deltas.builderIntegrity.deltaPct,
    bothFlat: deltas.economic.label === 'flat' && deltas.builderIntegrity.label === 'flat',
    commitMessages,
  })
}

/** Reject blurbs that ignore listed commits and only praise README/docs framing. */
export function summaryIgnoresCommitsForDocsOnly(
  text: string,
  commitMessages: string[],
): boolean {
  if (!commitMessages.length) return false
  const lower = text.toLowerCase()
  const docsLed =
    /\b(readme|documentation|docs|public framing|framing in its readme|documented purpose|documentation clarity)\b/.test(
      lower,
    )
  if (!docsLed) return false
  const mentionsCommitWork =
    /\b(commit|commits|shipped|landed|merged|diff|pr|pull request|implement|fix|refactor|added|updated)\b/.test(
      lower,
    )
  return !mentionsCommitWork
}

export async function generateRescoreChangeSummary(params: {
  oldRepo: Repo | null
  newRepo: Repo
  commitMessages: string[]
  evidence?: RescoreEvidenceForSummary | null
}): Promise<{ summary: string | null; summaryNormie: string | null; deltaHeader: string }> {
  const { oldRepo, newRepo, commitMessages, evidence } = params
  const deltas = computeRescoreDeltas(oldRepo, newRepo)
  const deltaHeader = formatRescoreDeltaHeader(deltas)
  const rowChanges = formatChangedRowsForPrompt(deltas)
  const flatFallback = fallbackFlatSummary(deltas, commitMessages)
  const normieFallback = fallbackNormieSummary(
    newRepo.githubSlug || newRepo.name,
    deltas,
    commitMessages,
  )

  if (!hasLlmApiKey()) {
    return { summary: null, summaryNormie: null, deltaHeader }
  }

  const commitsBlock = commitMessages.length
    ? commitMessages.map(m => `- ${m}`).join('\n')
    : '- No recent commit messages available'

  const evidenceBlock = formatEvidenceBlock(evidence)

  const shippingLeverageTag =
    newRepo.tag === 'theoretical' ||
    newRepo.tag === 'indirect' ||
    newRepo.tag === 'infrastructure'

  const shippingLeverageRules = shippingLeverageTag
    ? `
SHIPPING-LEVERAGE / RESEARCH-NOTEBOOK RULES (this repo is tagged ${newRepo.tag}):
- Recent pushes and topic folders prove activity, not that the repo is on the builder shipping path.
- Never cite “active push cadence” / “recent pushes” as the reason shipping leverage or Role fell — say the work did not hook into shipping tools or products people use.
- Prefer “lab notebook / learning tool” framing over prosecuting a named rubric row.
`
    : ''

  const prompt = `These are the old and new scores from a live rescore. The reader already sees the numeric delta header — do NOT restate it.

COMPUTED DELTAS (match these directions; do NOT quote “±N pts” or letter transitions as your explanation):
${deltaHeader}

Rubric row changes (already visible — do NOT use “row X moved low→mid” as the sole reason):
${rowChanges}

RECENT COMMITS (PRIMARY focus for this blurb — these are why the rescore ran):
${commitsBlock}

OLD SCORES:
${oldRepo ? formatRepoScores(oldRepo) : 'No prior score on record.'}

NEW SCORES (live rescore of current repo; each row has a source note):
${formatRepoScores(newRepo)}

${evidenceBlock}${shippingLeverageRules}Write TWO "what changed" blurbs with the SAME facts:

1) "summary" — 1–2 short sentences for builders/technical readers. Precise is fine (README, CI, commits, rubric evidence). Still no markdown. Hard max ~90 words.
2) "summaryNormie" — 1–2 short sentences Plain English for token holders who are not developers. MUST lead with what landed (from RECENT COMMITS) in everyday words, then a soft note on how the score moved. Never open with “money-side went up” / “builder-standards dipped” alone — that just restates the header. Sound like texting a smart friend — not a lab report.

BAD (do not write this — it dumps commit titles):
"clawd-containers landed fleet-health — per-VM in-guest claude-process count — the early burn signal, and cont account auto — pick by subscription POOL (org), not login dir. Builder standards went up."

GOOD (this is the voice):
"clawd-containers put in a check that counts how many AI workers are actually running in each little machine — an early heads-up if something starts burning money — plus a smarter way to pick which account to use. The quality reading went up."

Never paste kebab-case feature names, VM/POOL/login-dir jargon, or “Shipping leverage +N pts”. Translate the work into what a person would notice.

${normieVoiceGuidance('rescoreSummary')}

Shared rules (both fields):
- Lead with evidence, not the percentage: name concrete themes from RECENT COMMITS and/or cite NEW score row \`source\` notes that justify the new rubric *level*. The reader already sees ±N pts and letter moves in the header — do not open by restating them.
- Keep the repo slug (${newRepo.githubSlug || newRepo.name}); you may add a short plain gloss after it in summaryNormie.
- Never write “<row name> was moved to low/mid/high because…” — that mechanism is already on the card. Say what the commits/evidence show instead.
- Treat “row X moved low→mid” as mechanism already shown above — never use that alone as the reason a grade rose or fell. Say what evidence justified the new level.
- Ban openings that only restate “+N pts”, “rose to F (40%)”, or “Builder standards rose” without an evidence clause in the same sentence.
- Do not open with README/docs “framing/clarity/purpose” unless the commits themselves are docs-only and that is what moved a row.
- Do not open with “Builder standards rose N pts” or “Shipping leverage fell N pts”.
- NEW SCORES already include this rescore. Never say scores ignored newer commits, used an older snapshot, or should wait for a next cycle.
- If REPO EVIDENCE is present, never invent missing README/root docs that are listed there.
- If a score is flat, say the commits did not yet change the live scorecard reading (ambition in titles vs what is actually in the repo is fine).
- If a score fell, explain the harsher reading; do not say it improved.
- If a score rose, do not say it declined.
- Mention specific scorecard rows only when they changed in RUBRIC ROW CHANGES above — and even then, do not narrate the level transition as the reason.
- Do not promise a future rescore will fix the grade.

Return ONLY JSON: {"summary":"...","summaryNormie":"..."}`

  try {
    const { text: raw } = await generateText({
      prompt,
      maxTokens: 700,
      label: 'rescore-summary',
    })

    const parsed = parseDualSummary(raw)
    let summary = parsed.summary ? stripMarkdown(parsed.summary) : ''
    let summaryNormie = parsed.summaryNormie ? stripMarkdown(parsed.summaryNormie) : ''

    const rejectReason = (text: string, kind: 'tech' | 'normie'): string | null => {
      if (!text) return 'empty'
      if (summaryContradictsDeltas(text, deltas)) return 'contradicts-deltas'
      if (summaryClaimsStaleSnapshot(text)) return 'stale-snapshot'
      if (summaryClaimsMissingDocs(text)) return 'missing-docs'
      if (summaryDeniesListedRootFiles(text, evidence)) return 'denies-root-files'
      if (summaryIsCircularRestatement(text)) return 'circular-restatement'
      if (summaryIgnoresCommitsForDocsOnly(text, commitMessages)) return 'docs-only-ignores-commits'
      if (summaryTooLong(text)) return 'too-long'
      if (summaryBlamesPushCadenceForDrop(text)) return 'blames-push-cadence'
      if (kind === 'normie' && summaryNotNormieEnough(text)) return 'not-normie-enough'
      return null
    }

    const summaryReject = rejectReason(summary, 'tech')
    const normieReject = summaryNormie ? rejectReason(summaryNormie, 'normie') : 'empty'
    if (summaryReject) {
      console.warn('[rescoreChangeSummary] rejecting technical summary', {
        slug: newRepo.githubSlug || newRepo.name,
        reason: summaryReject,
        preview: summary.slice(0, 160),
      })
      summary = flatFallback
    }
    if (normieReject) {
      console.warn('[rescoreChangeSummary] rejecting normie summary', {
        slug: newRepo.githubSlug || newRepo.name,
        reason: normieReject,
        preview: (summaryNormie || '').slice(0, 160),
      })
      summaryNormie = normieFallback
    }
    if (!summary) summary = flatFallback

    return {
      summary: summary || null,
      summaryNormie: summaryNormie || null,
      deltaHeader,
    }
  } catch (err) {
    console.warn('[rescoreChangeSummary] generation failed:', err)
    return { summary: flatFallback, summaryNormie: normieFallback, deltaHeader }
  }
}

function parseDualSummary(raw: string | null | undefined): {
  summary: string
  summaryNormie: string
} {
  if (!raw?.trim()) return { summary: '', summaryNormie: '' }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const slice = raw.slice(start, end + 1)
    for (const candidate of [slice, slice.replace(/,\s*([}\]])/g, '$1')]) {
      try {
        const obj = JSON.parse(candidate) as Record<string, unknown>
        const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
        const summaryNormie =
          typeof obj.summaryNormie === 'string'
            ? obj.summaryNormie.trim()
            : typeof obj.normie === 'string'
              ? obj.normie.trim()
              : ''
        if (summary || summaryNormie) return { summary, summaryNormie }
      } catch {
        // try next candidate
      }
    }
  }
  // Non-JSON reply: keep as technical only — don't dual-write the same prose into PE
  // (that used to make both fields fail checks and land on the jargon fallback).
  const plain = stripMarkdown(raw).trim()
  return { summary: plain, summaryNormie: '' }
}
