import Anthropic from '@anthropic-ai/sdk'
import { Repo, Score } from './scores'
import { getEconomicScore, getShippingLeverage, getTokenMechanicForDisplay } from './economicGrade'
import { stripMarkdown } from './textCleanup'

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
  return formatScoreBlock('Token mechanic', getTokenMechanicForDisplay(repo))
}

function formatRepoScores(repo: Repo): string {
  return [
    `Tag: ${repo.tag} · Status: ${repo.status}`,
    formatEconomicBlock(repo),
    formatScoreBlock('Builder integrity', repo.builderIntegrity),
    `Verdict: ${repo.verdict}`,
  ].join('\n')
}

export async function generateRescoreChangeSummary(params: {
  oldRepo: Repo | null
  newRepo: Repo
  commitMessages: string[]
}): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const { oldRepo, newRepo, commitMessages } = params

  const commitsBlock = commitMessages.length
    ? commitMessages.map(m => `- ${m}`).join('\n')
    : '- No recent commit messages available'

  const prompt = `These are the old and new scores for this repo. Recent commits are provided.

OLD SCORES:
${oldRepo ? formatRepoScores(oldRepo) : 'No prior score on record.'}

NEW SCORES:
${formatRepoScores(newRepo)}

RECENT COMMITS:
${commitsBlock}

In 1-2 sentences, explain what changed and why — be specific about which scores moved and what the commits suggest. Plain English, no markdown.`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return text ? stripMarkdown(text) : null
  } catch (err) {
    console.warn('[rescoreChangeSummary] generation failed:', err)
    return null
  }
}
