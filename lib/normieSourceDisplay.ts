import { stripMarkdown } from '@/lib/textCleanup'

/**
 * Short readable clip of a technical "why this score" note for Plain English mode.
 * Deterministic — used as LLM fallback and client display when sourceNormie is missing.
 */
export function shortenSourceForNormieDisplay(text: string): string {
  const cleaned = stripMarkdown(text).replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  // One sentence max for readability; holders should not face walls of jargon.
  const first = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)[0] ?? cleaned
  if (first.length <= 140) return first
  return `${first.slice(0, 137).replace(/\s+\S*$/, '').trim()}…`
}
