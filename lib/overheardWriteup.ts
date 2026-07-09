import Anthropic from '@anthropic-ai/sdk'
import type { OverheardEntry, OverheardQuote } from '@/lib/podcastMentions'
import { formatRepoContextBlock, getOverheardRepoContext } from '@/lib/overheardRepoContext'

function formatQuotesForPrompt(quotes: OverheardQuote[], episodeName: string): string {
  return quotes
    .map((q, i) => `${i + 1}. ${q.speaker}: "${q.text}" (${episodeName}, ~${q.approxTimestampSec}s in)`)
    .join('\n')
}

export async function generateOverheardWriteup(entry: Pick<OverheardEntry, 'kind' | 'repoSlug' | 'episodeName' | 'quotes' | 'userContext'>): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const repoCtx = await getOverheardRepoContext(entry.repoSlug)
  const quoteBlock = formatQuotesForPrompt(entry.quotes, entry.episodeName)
  const isThread = entry.kind === 'thread' || entry.quotes.length > 1

  const prompt = isThread
    ? `You write "Overheard" — a short column for $CLAWD holders about noteworthy Slop.Computer podcast exchanges that reference clawdbotatg repos.

${formatRepoContextBlock(repoCtx)}

Episode: ${entry.episodeName}
${entry.userContext ? `Editor context: ${entry.userContext}` : ''}

Quotes in chronological order:
${quoteBlock}

Write 2-4 sentences that explain why this exchange matters to $CLAWD holders — not a neutral transcript recap. Connect what was said to the repo's role in the ecosystem. Casual, direct, no headers or bullet points. Don't invent facts beyond what's given.`
    : `You write "Overheard" — a short column for $CLAWD holders about noteworthy Slop.Computer podcast mentions of clawdbotatg repos.

${formatRepoContextBlock(repoCtx)}

Episode: ${entry.episodeName}
${entry.userContext ? `Editor context: ${entry.userContext}` : ''}

Quote — ${entry.quotes[0]?.speaker ?? 'speaker'}: "${entry.quotes[0]?.text ?? ''}"

Write 1-2 sentences explaining why this mention matters to $CLAWD holders. Casual, direct, no headers. Don't invent facts beyond what's given.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: isThread ? 400 : 200,
      messages: [{ role: 'user', content: prompt }],
    })
    return response.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
  } catch {
    return ''
  }
}
