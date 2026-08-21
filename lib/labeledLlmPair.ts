import { stripMarkdown } from './textCleanup'

/**
 * Split STANDARD: / PLAIN: dual LLM blocks.
 * Tolerates missing newline before PLAIN (models often write "...holders. PLAIN: ...").
 */
export function splitStandardPlainLabeled(
  raw: string | undefined | null,
): { standard: string; plain?: string } | null {
  if (!raw?.trim()) return null
  const text = stripMarkdown(raw).trim()
  if (!text) return null

  const plainMatch =
    text.match(/(?:^|\n)\s*PLAIN(?:\s+ENGLISH)?\s*:\s*/i) ??
    text.match(/\bPLAIN(?:\s+ENGLISH)?\s*:\s*/i)

  if (plainMatch && plainMatch.index != null) {
    const before = text.slice(0, plainMatch.index).replace(/^STANDARD\s*:\s*/i, '').trim()
    const after = text.slice(plainMatch.index + plainMatch[0].length).trim()
    const standard = before.replace(/^STANDARD\s*:\s*/i, '').trim()
    if (standard.length >= 40) {
      return { standard, ...(after.length >= 40 ? { plain: after } : {}) }
    }
  }

  if (/^STANDARD\s*:/i.test(text)) {
    const standard = text.replace(/^STANDARD\s*:\s*/i, '').trim()
    if (standard.length >= 40) return { standard }
  }

  return null
}

/** Prefer the PLAIN half when a cached field still contains both labels. */
export function preferPlainFromLabeled(raw: string | undefined | null): string | null {
  const split = splitStandardPlainLabeled(raw)
  if (split?.plain) return split.plain
  if (split?.standard) return split.standard
  return null
}

/** Prefer the STANDARD half when a cached field still contains both labels. */
export function preferStandardFromLabeled(raw: string | undefined | null): string | null {
  const split = splitStandardPlainLabeled(raw)
  if (split?.standard) return split.standard
  return null
}
