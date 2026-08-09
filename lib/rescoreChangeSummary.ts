import { generateText, hasLlmApiKey } from './llm'
import { Repo, Score } from './scores'
import { getShippingLeverage, getTokenMechanicForDisplay } from './economicGrade'
import { stripMarkdown } from './textCleanup'
import { normieVoiceGuidance } from './normieVoice'
import { buildNormieWhatChangedBlurb } from './rescoreSummaries'
import {
  computeRescoreDeltas,
  formatChangedRowsForPrompt,
  formatRescoreDeltaHeader,
  type RescoreAggregateDelta,
  type RubricRowDelta,
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
  const rising =
    /\b(should rise|will rise|bump(ed)? up|increase(d)?|improv(ed|e)|stronger|higher)\b/.test(lower)
  const falling =
    /\b(should fall|drop(ped)?|decrease(d)?|lower|weaker|declin(ed|e))\b/.test(lower)

  if (deltas.builderIntegrity.deltaPct != null && deltas.builderIntegrity.deltaPct < 0 && rising && !falling) {
    return true
  }
  if (deltas.builderIntegrity.deltaPct != null && deltas.builderIntegrity.deltaPct > 0 && falling && !rising) {
    return true
  }
  if (deltas.economic.deltaPct != null && deltas.economic.deltaPct < 0 && rising && !falling) {
    return true
  }
  if (deltas.economic.deltaPct != null && deltas.economic.deltaPct > 0 && falling && !rising) {
    return true
  }
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
    const restatesMove =
      /\b(rose|fell|increased|decreased|climbed|dropped)\s+\d+\s*pts?\b/.test(lower) ||
      /\b(rose|fell)\s+to\s+[a-f][+\-]?\b/.test(lower) ||
      /\b[+\-]\d+\s*pts?\b/.test(lower)

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
      .replace(
        /\b(builder standards|shipping leverage|holder economics|overall|grade|score|the|a|an|to|from|on|in|and|this|rescore)\b/g,
        ' ',
      )
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (withoutMoveBoilerplate.length < 20) return true
  }
  return false
}

function changedRows(deltas: RescoreAggregateDelta): RubricRowDelta[] {
  return [
    ...deltas.rowDeltas.shippingLeverage,
    ...deltas.rowDeltas.tokenMechanic,
    ...deltas.rowDeltas.builderIntegrity,
  ].filter(r => r.oldLevel != null && r.oldLevel !== r.newLevel)
}

function formatCommitHint(commitMessages: string[]): string {
  if (!commitMessages.length) return ''
  const titles = commitMessages
    .slice(0, 3)
    .map(m => m.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (!titles.length) return ''
  return ` Recent commits in this rescore window: ${titles.join('; ')}.`
}

function fallbackFlatSummary(deltas: RescoreAggregateDelta, commitMessages: string[] = []): string {
  const commitHint = formatCommitHint(commitMessages)
  const bothFlat = deltas.economic.label === 'flat' && deltas.builderIntegrity.label === 'flat'
  if (bothFlat) {
    return `The score stayed the same — those recent commits did not change how this project reads on the scorecard yet.${commitHint}`
  }

  const rows = changedRows(deltas)
  if (rows.length) {
    const bits = rows
      .slice(0, 2)
      .map(r => `${r.label} ${r.oldLevel} → ${r.newLevel}`)
      .join('; ')
    return (
      `${bits} on this rescore. Expand those rows for the source notes that justify the new levels` +
      ` — the move itself is not the reason.${commitHint}`
    )
  }

  if (
    (deltas.economic.deltaPct != null && deltas.economic.deltaPct < 0) ||
    (deltas.builderIntegrity.deltaPct != null && deltas.builderIntegrity.deltaPct < 0)
  ) {
    return `The score moved as shown above on a stricter reading of what is in the repo today versus those recent commits.${commitHint}`
  }
  return `The score moved as shown above. Recent commits do not always move every scorecard row yet.${commitHint}`
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

${evidenceBlock}Write TWO "what changed" blurbs with the SAME facts:

1) "summary" — 1–2 sentences for builders/technical readers. Precise is fine (README, CI, commits, rubric evidence). Still no markdown.
2) "summaryNormie" — 1–2 sentences Plain English for token holders who are not developers. MUST lead with what landed (from RECENT COMMITS) in everyday words, then a soft note on how the score moved. Never open with “money-side went up” / “builder-standards dipped” alone — that just restates the header.

${normieVoiceGuidance('rescoreSummary')}

Shared rules (both fields):
- Lead with evidence, not the percentage: name concrete themes from RECENT COMMITS and/or cite NEW score row \`source\` notes that justify the new rubric *level*. The reader already sees ±N pts and letter moves in the header — do not open by restating them.
- Keep the repo slug (${newRepo.githubSlug || newRepo.name}); you may add a short plain gloss after it in summaryNormie.
- Treat “row X moved low→mid” as mechanism already shown above — never use that alone as the reason a grade rose or fell. Say what evidence justified the new level.
- Ban openings that only restate “+N pts”, “rose to F (40%)”, or “Builder standards rose” without an evidence clause in the same sentence.
- Do not open with README/docs “framing/clarity/purpose” unless the commits themselves are docs-only and that is what moved a row.
- Do not open with “Builder standards rose N pts” or “Shipping leverage fell N pts”.
- NEW SCORES already include this rescore. Never say scores ignored newer commits, used an older snapshot, or should wait for a next cycle.
- If REPO EVIDENCE is present, never invent missing README/root docs that are listed there.
- If a score is flat, say the commits did not yet change the live scorecard reading (ambition in titles vs what is actually in the repo is fine).
- If a score fell, explain the harsher reading; do not say it improved.
- If a score rose, do not say it declined.
- Mention specific scorecard rows only when they changed in RUBRIC ROW CHANGES above.
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

    const bad = (text: string) =>
      Boolean(text) &&
      (summaryContradictsDeltas(text, deltas) ||
        summaryClaimsStaleSnapshot(text) ||
        summaryClaimsMissingDocs(text) ||
        summaryDeniesListedRootFiles(text, evidence) ||
        summaryIsCircularRestatement(text) ||
        summaryIgnoresCommitsForDocsOnly(text, commitMessages))

    if (bad(summary)) summary = flatFallback
    if (bad(summaryNormie) || !summaryNormie) summaryNormie = normieFallback
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
    try {
      const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
      const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
      const summaryNormie =
        typeof obj.summaryNormie === 'string'
          ? obj.summaryNormie.trim()
          : typeof obj.normie === 'string'
            ? obj.normie.trim()
            : ''
      if (summary || summaryNormie) return { summary, summaryNormie }
    } catch {
      // fall through — older single-paragraph replies
    }
  }
  const plain = stripMarkdown(raw).trim()
  return { summary: plain, summaryNormie: plain }
}
