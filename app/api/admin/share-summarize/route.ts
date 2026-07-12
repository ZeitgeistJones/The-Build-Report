import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { middleVoiceGuidanceForTweet } from '@/lib/middleVoice'
import {
  TBR_SITE_URL,
  X_CHAR_LIMIT,
  enforceWeightedLimit,
  formatShareDate,
  xWeightedLength,
  type ShareVoice,
} from '@/lib/xSharePosts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Soft floor for Under 280 variants — expand if below this. */
const X_TWEET_MIN_CHARS = 255

type Kind = 'brief' | 'needle'

/**
 * Summarize a full brief/Needle draft into 3 under-280 tweet variants for the admin share tool.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const denied = await guardAdmin(req, (body as { password?: unknown }).password)
  if (denied) return denied

  const kind = (body as { kind?: string }).kind
  const text = typeof (body as { text?: unknown }).text === 'string' ? (body as { text: string }).text.trim() : ''
  // Default false — site URL burns ~23 weighted chars; opt in from admin checkbox.
  const includeLink = (body as { includeLink?: boolean }).includeLink === true
  const dateKey =
    typeof (body as { dateKey?: unknown }).dateKey === 'string'
      ? (body as { dateKey: string }).dateKey.trim()
      : ''
  const voiceRaw = (body as { voice?: unknown }).voice
  const voice: ShareVoice = voiceRaw === 'normie' ? 'normie' : 'standard'

  if (kind !== 'brief' && kind !== 'needle') {
    return NextResponse.json({ ok: false, error: 'kind must be brief or needle' }, { status: 400 })
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: 'Missing text to summarize' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  try {
    const variants = await summarizeToTweetVariants(kind, text, includeLink, dateKey, voice)
    return NextResponse.json({
      ok: true,
      variants,
      lengths: variants.map(v => xWeightedLength(v)),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Summarize failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function summarizeToTweetVariants(
  kind: Kind,
  sourceText: string,
  includeLink: boolean,
  dateKey: string,
  voice: ShareVoice,
): Promise<[string, string, string]> {
  const label = kind === 'brief' ? "Yesterday's Build" : 'The Needle'
  const dateLabel = dateKey ? formatShareDate(dateKey) : ''
  const briefOpener = dateLabel ? `${dateLabel} Build:` : ''
  const urlRule = includeLink
    ? `Each variant MUST end with a blank line then exactly: ${TBR_SITE_URL}`
    : 'Do NOT include any URL.'

  const openerRule =
    kind === 'brief' && briefOpener
      ? `Each variant MUST start with exactly: ${briefOpener} (not "Yesterday's Build — …").`
      : kind === 'needle'
        ? 'Keep The Needle framing if useful; do not use a Yesterday\'s Build opener.'
        : ''

  const lengthRule = `Each variant should be ${X_TWEET_MIN_CHARS}–${X_CHAR_LIMIT} characters (URLs count as 23). Pack concrete detail from the source — not filler. Hard max ${X_CHAR_LIMIT}.`

  const voiceBlock =
    voice === 'normie'
      ? `\nVoice (Plain English → Middle, not site Normie and not Full Normie ELI5):\n${middleVoiceGuidanceForTweet()}\n`
      : `\nVoice: friendly, clear, light personality — no hype, no invented facts. You may keep normal product/tech wording.\n`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You write X/Twitter posts for The Build Report (independent community project scoring clawdbotatg repos).

Task: turn this full ${label} draft into THREE different tweet-sized variants. Same facts; different wording, emphasis, and length. Name at most 1–2 repos if space allows.
${voiceBlock}
SOURCE DRAFT:
"""
${sourceText.slice(0, 6000)}
"""

Hard rules:
- ${lengthRule}
- ${openerRule}
- ${urlRule}
- No hashtags unless already in the source.
- Return ONLY valid JSON (no markdown fences):
{ "variants": ["...", "...", "..."] }
`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1400,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
  if (!raw) throw new Error('Empty summarize response')

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Summarize response was not JSON')

  const parsed = JSON.parse(jsonMatch[0]) as { variants?: unknown }
  if (!Array.isArray(parsed.variants) || parsed.variants.length < 3) {
    throw new Error('Expected 3 variants')
  }

  const cleaned = await Promise.all(
    parsed.variants.slice(0, 3).map(async v => {
      let s = typeof v === 'string' ? v.trim() : ''
      if (!s) s = sourceText.slice(0, 200)
      if (kind === 'brief' && briefOpener) s = ensureBriefOpener(s, briefOpener)
      if (includeLink && !s.includes(TBR_SITE_URL)) {
        s = `${s.trim()}\n\n${TBR_SITE_URL}`
      }
      if (!includeLink) {
        s = s.replace(new RegExp(`\\s*${TBR_SITE_URL.replace(/\./g, '\\.')}\\s*`, 'g'), '').trim()
      }
      s = enforceWeightedLimit(s, X_CHAR_LIMIT)
      if (xWeightedLength(s) < X_TWEET_MIN_CHARS) {
        s = await expandVariant(client, {
          kind,
          sourceText,
          shortText: s,
          includeLink,
          briefOpener,
          voice,
        })
        if (kind === 'brief' && briefOpener) s = ensureBriefOpener(s, briefOpener)
        if (includeLink && !s.includes(TBR_SITE_URL)) {
          s = `${s.trim()}\n\n${TBR_SITE_URL}`
        }
        if (!includeLink) {
          s = s.replace(new RegExp(`\\s*${TBR_SITE_URL.replace(/\./g, '\\.')}\\s*`, 'g'), '').trim()
        }
        s = enforceWeightedLimit(s, X_CHAR_LIMIT)
      }
      return s
    }),
  )

  return cleaned as [string, string, string]
}

function ensureBriefOpener(text: string, opener: string): string {
  let body = text.trim()
  body = body
    .replace(/^Yesterday'?s\s+Build\s*[—–\-:]\s*[A-Za-z]{3}\s+\d{1,2}\s*:?\s*/i, '')
    .replace(/^Yesterday'?s\s+Build\s*:?\s*/i, '')
    .replace(/^[A-Za-z]{3}\s+\d{1,2}\s+Build\s*:?\s*/i, '')
    .trim()
  if (body.toLowerCase().startsWith(opener.toLowerCase())) return body
  return `${opener} ${body}`
}

async function expandVariant(
  client: Anthropic,
  opts: {
    kind: Kind
    sourceText: string
    shortText: string
    includeLink: boolean
    briefOpener: string
    voice: ShareVoice
  },
): Promise<string> {
  const urlRule = opts.includeLink
    ? `Keep trailing site URL exactly: ${TBR_SITE_URL}`
    : 'Do NOT include any URL.'
  const openerRule =
    opts.kind === 'brief' && opts.briefOpener
      ? `Must start with exactly: ${opts.briefOpener}`
      : ''
  const voiceBit =
    opts.voice === 'normie'
      ? `Stay in Middle voice (plain explanatory, not baby-talk):\n${MIDDLE_EXPAND_HINT}`
      : 'Stay friendly and clear; add concrete detail from the source.'

  const prompt = `Lengthen this X post so it is ${X_TWEET_MIN_CHARS}–${X_CHAR_LIMIT} characters (URLs=23). Same facts only — add concrete detail from the source draft. No invented facts. No hashtags.
${voiceBit}
${openerRule}
${urlRule}

SOURCE DRAFT:
"""
${opts.sourceText.slice(0, 4000)}
"""

SHORT POST:
"""
${opts.shortText}
"""

Return ONLY the expanded post text (no JSON, no quotes).`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const out = response.content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
  return out || opts.shortText
}

const MIDDLE_EXPAND_HINT =
  'Explain what happened in plain words. Prefer projects/updates. No Wow/Nice. No unexplained jargon.'
