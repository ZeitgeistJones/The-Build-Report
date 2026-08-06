import { stripMarkdown } from '@/lib/textCleanup'

/**
 * Short readable clip for Plain English mode when no LLM rewrite exists.
 * Prefer 1–2 sentences — fallback only; real PE notes come from the LLM.
 */
export function shortenSourceForNormieDisplay(text: string): string {
  const cleaned = stripMarkdown(text).replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  let clipped = parts.slice(0, 2).join(' ')
  if (!clipped) clipped = cleaned
  // ~40–55 words ≈ 280–340 chars
  if (clipped.length <= 300) return clipped
  return `${clipped.slice(0, 297).replace(/\s+\S*$/, '').trim()}…`
}
