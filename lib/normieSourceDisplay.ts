import { stripMarkdown } from '@/lib/textCleanup'

/**
 * Short readable clip of a technical "why this score" note for Plain English mode.
 * Deterministic — used as Gemini fallback and client display when sourceNormie is missing.
 */
export function shortenSourceForNormieDisplay(text: string): string {
  const cleaned = stripMarkdown(text).replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  // Prefer a single sentence; allow a second only if both stay short.
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  let clipped = parts[0] ?? ''
  if (parts[1] && clipped.length + parts[1].length < 160) {
    clipped = `${clipped} ${parts[1]}`
  }
  return clipped.length > 180 ? `${clipped.slice(0, 177).trim()}…` : clipped
}
