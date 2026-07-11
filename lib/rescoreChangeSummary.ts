import Anthropic from '@anthropic-ai/sdk'
import { Repo, Score } from './scores'
import { getShippingLeverage, getTokenMechanicForDisplay } from './economicGrade'
import { stripMarkdown } from './textCleanup'
import {
  computeRescoreDeltas,
  formatChangedRowsForPrompt,
  formatRescoreDeltaHeader,
  type RescoreAggregateDelta,
} from './rescoreDeltas'

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

function fallbackFlatSummary(deltas: RescoreAggregateDelta): string {
  const bothFlat = deltas.economic.label === 'flat' && deltas.builderIntegrity.label === 'flat'
  if (bothFlat) {
    return 'Scores stayed flat. Commit messages may describe more ambition than the current repo evidence supports for the rubric.'
  }
  return 'Scores shifted as shown above. Recent commits may not yet move every rubric level.'
}

export async function generateRescoreChangeSummary(params: {
  oldRepo: Repo | null
  newRepo: Repo
  commitMessages: string[]
}): Promise<{ summary: string | null; deltaHeader: string }> {
  const { oldRepo, newRepo, commitMessages } = params
  const deltas = computeRescoreDeltas(oldRepo, newRepo)
  const deltaHeader = formatRescoreDeltaHeader(deltas)
  const rowChanges = formatChangedRowsForPrompt(deltas)

  if (!process.env.ANTHROPIC_API_KEY) {
    return { summary: null, deltaHeader }
  }

  const commitsBlock = commitMessages.length
    ? commitMessages.map(m => `- ${m}`).join('\n')
    : '- No recent commit messages available'

  const prompt = `These are the old and new scores from a live rescore that just ran on the current repo. Recent commits are context only.

COMPUTED DELTAS (authoritative — your narrative MUST match these directions):
${deltaHeader}

Rubric row changes:
${rowChanges}

OLD SCORES:
${oldRepo ? formatRepoScores(oldRepo) : 'No prior score on record.'}

NEW SCORES (this rescore — current repo evidence):
${formatRepoScores(newRepo)}

RECENT COMMITS:
${commitsBlock}

Write 1-2 sentences explaining what changed and why. Rules:
- NEW SCORES already reflect this rescore of the current repo. Never say scores ignored newer commits, used an older snapshot, scored before these commits landed, or should wait for a "next cycle" to count them.
- If a score is flat, say it stayed flat because the current evidence still supports that level — e.g. commit messages sound ahead of what the tree/README actually show. Do not invent timing excuses.
- If a score fell, do not say it should rise or improved.
- If a score rose, do not say it declined.
- Mention specific rubric rows only when they changed in RUBRIC ROW CHANGES above.
- Do not promise a future rescore will fix the grade.
Plain English, no markdown.`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 180,
      messages: [{ role: 'user', content: prompt }],
    })
    let text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    text = text ? stripMarkdown(text) : ''

    if (text && (summaryContradictsDeltas(text, deltas) || summaryClaimsStaleSnapshot(text))) {
      text = fallbackFlatSummary(deltas)
    }

    return { summary: text || null, deltaHeader }
  } catch (err) {
    console.warn('[rescoreChangeSummary] generation failed:', err)
    return { summary: null, deltaHeader }
  }
}
