import { stripMarkdown } from '@/lib/textCleanup'

/**
 * Readable clip of a technical "why this score" note for Plain English mode.
 * Deterministic — used as LLM fallback and client display when sourceNormie is missing.
 * Keeps most points (up to ~3 sentences) while staying shorter than a full technical dump.
 */
export function shortenSourceForNormieDisplay(text: string): string {
  const cleaned = stripMarkdown(text).replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  // Cover most points: up to 3 sentences / ~450 chars (~70–80 words).
  let clipped = parts.slice(0, 3).join(' ')
  if (!clipped) clipped = cleaned
  if (clipped.length <= 450) return clipped
  return `${clipped.slice(0, 447).replace(/\s+\S*$/, '').trim()}…`
}
