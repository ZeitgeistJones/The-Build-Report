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

  const prompt = `These are the old and new scores for this repo. Recent commits are provided.

COMPUTED DELTAS (authoritative — your narrative MUST match these directions):
${deltaHeader}

Rubric row changes:
${rowChanges}

OLD SCORES:
${oldRepo ? formatRepoScores(oldRepo) : 'No prior score on record.'}

NEW SCORES:
${formatRepoScores(newRepo)}

RECENT COMMITS:
${commitsBlock}

Write 1-2 sentences explaining what changed and why, grounded in the commits. Rules:
- If a score is flat, say it stayed flat — do not claim it rose or fell.
- If a score fell, do not say it should rise or improved.
- If a score rose, do not say it declined.
- Mention specific rubric rows only when they changed in RUBRIC ROW CHANGES above.
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

    if (text && summaryContradictsDeltas(text, deltas)) {
      text = `Scores ${deltas.economic.label === 'flat' && deltas.builderIntegrity.label === 'flat' ? 'unchanged overall' : 'shifted as shown above'}. Recent commits may not yet move rubric levels.`
    }

    return { summary: text || null, deltaHeader }
  } catch (err) {
    console.warn('[rescoreChangeSummary] generation failed:', err)
    return { summary: null, deltaHeader }
  }
}
