/** Client-safe helpers for composing X/Twitter posts from brief + needle copy. */

export const TBR_SITE_URL = 'https://the-build-report.vercel.app'
/** X free-tier limit; URLs in the body count as 23 chars each. */
export const X_CHAR_LIMIT = 280
const X_URL_WEIGHT = 23

export type ShareVoice = 'standard' | 'normie'

export type ShareBriefSource = {
  general: string
  generalNormie?: string | null
  dateKey: string
  repoCount: number
  commitCount: number
}

export type ShareNeedleSource = {
  text: string
  textNormie?: string | null
  dateKey: string
  repoCount: number
}

/** Approximate X's weighted length (t.co URLs ≈ 23). */
export function xWeightedLength(text: string): number {
  const urlRe = /https?:\/\/[^\s]+/gi
  let length = text.length
  const matches = text.match(urlRe) ?? []
  for (const url of matches) {
    length = length - url.length + X_URL_WEIGHT
  }
  return length
}

export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`
}

function briefBody(source: ShareBriefSource, voice: ShareVoice): string {
  if (voice === 'normie' && source.generalNormie?.trim()) return source.generalNormie.trim()
  return source.general.trim()
}

function needleBody(source: ShareNeedleSource, voice: ShareVoice): string {
  if (voice === 'normie' && source.textNormie?.trim()) return source.textNormie.trim()
  return source.text.trim()
}

export function formatShareDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return dateKey
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${d}`
}

/** Default shareable post for Yesterday's Build (full text — use for copy/thread). */
export function composeBriefPost(
  source: ShareBriefSource,
  voice: ShareVoice,
  opts: { includeLink?: boolean } = {},
): string {
  const includeLink = opts.includeLink !== false
  const body = briefBody(source, voice)
  const header = `Yesterday's Build — ${formatShareDate(source.dateKey)}`
  const meta = `${source.repoCount} repos · ${source.commitCount} commits`
  const parts = [header, '', body, '', meta]
  if (includeLink) parts.push(TBR_SITE_URL)
  return parts.join('\n').trim()
}

/** Default shareable post for The Needle (full text — use for copy/thread). */
export function composeNeedlePost(
  source: ShareNeedleSource,
  voice: ShareVoice,
  opts: { includeLink?: boolean } = {},
): string {
  const includeLink = opts.includeLink !== false
  const body = needleBody(source, voice)
  const header = 'The Needle'
  const meta =
    source.repoCount === 1
      ? '1 repo moved'
      : `${source.repoCount} repos moved`
  const parts = [header, '', body, '', meta]
  if (includeLink) parts.push(TBR_SITE_URL)
  return parts.join('\n').trim()
}

/** Short caption for X intent when the full writeup ships as an image. */
export function composeShortCaption(
  kind: 'brief' | 'needle',
  source: { dateKey: string; repoCount?: number; commitCount?: number },
): string {
  if (kind === 'brief') {
    return `Yesterday's Build — ${formatShareDate(source.dateKey)}\n${TBR_SITE_URL}`
  }
  const moved =
    source.repoCount == null
      ? null
      : source.repoCount === 1
        ? '1 repo moved'
        : `${source.repoCount} repos moved`
  return moved
    ? `The Needle — ${formatShareDate(source.dateKey)}\n${moved}\n${TBR_SITE_URL}`
    : `The Needle — ${formatShareDate(source.dateKey)}\n${TBR_SITE_URL}`
}

/**
 * Split long copy into thread-sized tweets. Link goes on the last tweet only.
 * Keeps sentence boundaries when possible.
 */
export function splitIntoThread(fullText: string, limit = X_CHAR_LIMIT): string[] {
  const trimmed = fullText.trim()
  if (!trimmed) return []
  if (xWeightedLength(trimmed) <= limit) return [trimmed]

  // Pull trailing site URL off so it lands on the last tweet only.
  let body = trimmed
  let trailer = ''
  if (body.endsWith(TBR_SITE_URL)) {
    body = body.slice(0, -TBR_SITE_URL.length).trimEnd()
    trailer = TBR_SITE_URL
  }

  const sentences =
    body.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) ?? [body]

  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence
    // Reserve room for " (n/m)" suffix (~8) on every part.
    if (xWeightedLength(next) > limit - 10 && current) {
      chunks.push(current)
      current = sentence
    } else {
      current = next
    }
  }
  if (current) chunks.push(current)

  // If a single sentence still overflows, hard-split by words.
  const hard: string[] = []
  for (const chunk of chunks) {
    if (xWeightedLength(chunk) <= limit - 10) {
      hard.push(chunk)
      continue
    }
    const words = chunk.split(/\s+/)
    let line = ''
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (xWeightedLength(next) > limit - 10 && line) {
        hard.push(line)
        line = w
      } else {
        line = next
      }
    }
    if (line) hard.push(line)
  }

  const total = hard.length
  return hard.map((part, i) => {
    const n = `${i + 1}/${total}`
    const withNum = `${part} (${n})`
    if (i === total - 1 && trailer) return `${withNum}\n\n${trailer}`
    return withNum
  })
}
