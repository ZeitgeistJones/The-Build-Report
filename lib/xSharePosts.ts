/** Client-safe helpers for composing X/Twitter posts. */

export const TBR_SITE_URL = 'https://the-build-report.vercel.app'
/** X free-tier limit; URLs in the body count as 23 chars each. */
export const X_CHAR_LIMIT = 280
const X_URL_WEIGHT = 23

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
