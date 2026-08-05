import { stripMarkdown } from '@/lib/textCleanup'

/**
 * Short readable clip of a technical "why this score" note for Plain English mode.
 * Deterministic — used as LLM fallback and client display when sourceNormie is missing.
 */
export function shortenSourceForNormieDisplay(text: string): string {
  const cleaned = stripMarkdown(text).replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  // Prefer one sentence; allow a second when both stay short (~1–2 sentences / ~40 words).
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  let clipped = parts[0] ?? cleaned
  if (parts[1] && clipped.length + 1 + parts[1].length <= 220) {
    clipped = `${clipped} ${parts[1]}`
  }
  if (clipped.length <= 220) return clipped
  return `${clipped.slice(0, 217).replace(/\s+\S*$/, '').trim()}…`
}
