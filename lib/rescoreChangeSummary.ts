import { generateText, hasLlmApiKey } from './llm'
import { Repo, Score } from './scores'
import { getShippingLeverage, getTokenMechanicForDisplay } from './economicGrade'
import { stripMarkdown } from './textCleanup'
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
  const lines = [`REPO EVIDENCE AT RESCORE (authoritative current state):`, `Root files: ${roots}`]
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

function fallbackFlatSummary(deltas: RescoreAggregateDelta): string {
  const bothFlat = deltas.economic.label === 'flat' && deltas.builderIntegrity.label === 'flat'
  if (bothFlat) {
    return 'Scores stayed flat. Commit messages may describe more ambition than the current repo evidence supports for the rubric.'
  }
  if (
    (deltas.economic.deltaPct != null && deltas.economic.deltaPct < 0) ||
    (deltas.builderIntegrity.deltaPct != null && deltas.builderIntegrity.deltaPct < 0)
  ) {
    return 'Scores shifted as shown above based on the current repo evidence. Recent commits are context only and do not override the live tree and README the scorer already read.'
  }
  return 'Scores shifted as shown above. Recent commits may not yet move every rubric level.'
}

export async function generateRescoreChangeSummary(params: {
  oldRepo: Repo | null
  newRepo: Repo
  commitMessages: string[]
  evidence?: RescoreEvidenceForSummary | null
}): Promise<{ summary: string | null; deltaHeader: string }> {
  const { oldRepo, newRepo, commitMessages, evidence } = params
  const deltas = computeRescoreDeltas(oldRepo, newRepo)
  const deltaHeader = formatRescoreDeltaHeader(deltas)
  const rowChanges = formatChangedRowsForPrompt(deltas)

  if (!hasLlmApiKey()) {
    return { summary: null, deltaHeader }
  }

  const commitsBlock = commitMessages.length
    ? commitMessages.map(m => `- ${m}`).join('\n')
    : '- No recent commit messages available'

  const evidenceBlock = formatEvidenceBlock(evidence)

  const prompt = `These are the old and new scores from a live rescore that just ran on the current repo. Recent commits are context only.

COMPUTED DELTAS (authoritative — your narrative MUST match these directions):
${deltaHeader}

Rubric row changes:
${rowChanges}

OLD SCORES:
${oldRepo ? formatRepoScores(oldRepo) : 'No prior score on record.'}

NEW SCORES (this rescore — already grounded in current repo evidence):
${formatRepoScores(newRepo)}

${evidenceBlock}RECENT COMMITS (context only — do NOT treat as more authoritative than REPO EVIDENCE / NEW SCORES):
${commitsBlock}

Write 1-2 sentences explaining what changed and why. Rules:
- NEW SCORES already reflect this rescore of the current repo. Never say scores ignored newer commits, used an older snapshot, scored before these commits landed, or should wait for a "next cycle" to count them.
- If REPO EVIDENCE is present, treat Root files + README as the current state. Never claim README, root tree, architecture docs, plans, tests, or engines are missing, outdated, or "have not caught up" when they appear there or when NEW score sources already cite them.
- Prefer explaining score moves from the changed rubric rows and their source notes — not from inventing documentation gaps.
- If a score is flat, say it stayed flat because the current evidence still supports that level — e.g. commit messages sound ahead of what the tree/README actually show. Do not invent timing excuses.
- If a score fell, do not say it should rise or improved. Explain the harsher reading of current evidence without inventing missing files.
- If a score rose, do not say it declined.
- Mention specific rubric rows only when they changed in RUBRIC ROW CHANGES above.
- Do not promise a future rescore will fix the grade.
Plain English, no markdown.`

  try {
    const { text: raw } = await generateText({
      prompt,
      maxTokens: 180,
      label: 'rescore-summary',
    })
    let text = raw ? stripMarkdown(raw) : ''

    if (
      text &&
      (summaryContradictsDeltas(text, deltas) ||
        summaryClaimsStaleSnapshot(text) ||
        summaryClaimsMissingDocs(text) ||
        summaryDeniesListedRootFiles(text, evidence))
    ) {
      text = fallbackFlatSummary(deltas)
    }

    return { summary: text || null, deltaHeader }
  } catch (err) {
    console.warn('[rescoreChangeSummary] generation failed:', err)
    return { summary: null, deltaHeader }
  }
}
