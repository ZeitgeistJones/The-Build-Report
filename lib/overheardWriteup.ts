import { generateText, hasLlmApiKey } from '@/lib/llm'
import type { OverheardEntry, OverheardQuote } from '@/lib/podcastMentions'
import { formatRepoContextBlock, getOverheardRepoContext } from '@/lib/overheardRepoContext'
import { stripMarkdown } from '@/lib/textCleanup'
import { normieVoiceGuidance } from '@/lib/normieVoice'

export type OverheardWriteupPair = {
  writeup: string
  writeupNormie?: string
}

function formatQuotesForPrompt(quotes: OverheardQuote[], episodeName: string): string {
  return quotes
    .map((q, i) => `${i + 1}. ${q.speaker}: "${q.text}" (${episodeName}, ~${q.approxTimestampSec}s in)`)
    .join('\n')
}

export async function generateOverheardWriteup(
  entry: Pick<OverheardEntry, 'kind' | 'repoSlug' | 'episodeName' | 'quotes' | 'userContext'>,
): Promise<OverheardWriteupPair> {
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

Write a standard column and a plain-English version. For the standard writeup: 2-4 sentences that explain why this exchange matters to $CLAWD holders — not a neutral transcript recap. Connect what was said to the repo's role in the ecosystem. Casual, direct, no headers or bullet points. Don't invent facts beyond what's given.

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "writeup": "2-4 sentences following the instructions above.",
  "writeupNormie": "Same facts and repo names as writeup, rewritten for someone who knows nothing about code or crypto."
}

NORMIE VOICE GUIDE (applies to writeupNormie only):
${normieVoiceGuidance('overheard')}`
    : `You write "Overheard" — a short column for $CLAWD holders about noteworthy Slop.Computer podcast mentions of clawdbotatg repos.

${formatRepoContextBlock(repoCtx)}

Episode: ${entry.episodeName}
${entry.userContext ? `Editor context: ${entry.userContext}` : ''}

Quote — ${entry.quotes[0]?.speaker ?? 'speaker'}: "${entry.quotes[0]?.text ?? ''}"

Write a standard column and a plain-English version. For the standard writeup: 1-2 sentences explaining why this mention matters to $CLAWD holders. Casual, direct, no headers. Don't invent facts beyond what's given.

Return ONLY valid JSON (no markdown fences) with this shape:
{
  "writeup": "1-2 sentences following the instructions above.",
  "writeupNormie": "Same facts and repo names as writeup, rewritten for someone who knows nothing about code or crypto."
}

NORMIE VOICE GUIDE (applies to writeupNormie only):
${normieVoiceGuidance('overheard')}`

  try {
    const { text: raw } = await generateText({
      prompt,
      maxTokens: isThread ? 600 : 400,
      label: 'overheard',
    })
    if (!raw) return { writeup: '' }

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // Older models sometimes return bare prose — treat as standard writeup only.
      return { writeup: stripMarkdown(raw).trim() }
    }
    const parsed = JSON.parse(jsonMatch[0]) as { writeup?: string; writeupNormie?: string }
    const writeup = typeof parsed.writeup === 'string' ? stripMarkdown(parsed.writeup).trim() : ''
    if (!writeup) return { writeup: '' }
    const writeupNormie =
      typeof parsed.writeupNormie === 'string' ? stripMarkdown(parsed.writeupNormie).trim() : ''
    return writeupNormie ? { writeup, writeupNormie } : { writeup }
  } catch {
    return { writeup: '' }
  }
}

/** Rewrite an existing Overheard writeup into plain-English (same facts). */
export async function rewriteOverheardWriteupNormie(
  entry: Pick<OverheardEntry, 'writeup' | 'repoSlug' | 'episodeName' | 'quotes'>,
): Promise<string | null> {
  if (!entry.writeup.trim() || !hasLlmApiKey()) return null
  const quoteBlock = formatQuotesForPrompt(entry.quotes, entry.episodeName)
  const prompt = `Rewrite this Overheard column writeup into plain English for someone who knows nothing about code or crypto. Keep the same facts and repo names. Do not add new claims.

Repo: ${entry.repoSlug}
Episode: ${entry.episodeName}
Quotes:
${quoteBlock || '(none)'}

Writeup:
"""
${entry.writeup}
"""

Return ONLY the rewritten paragraph (no JSON, no labels, no markdown).

NORMIE VOICE GUIDE:
${normieVoiceGuidance('overheard')}`

  try {
    const { text: raw } = await generateText({
      prompt,
      maxTokens: 400,
      label: 'overheard-normie',
    })
    const text = stripMarkdown(raw).trim()
    return text || null
  } catch {
    return null
  }
}
