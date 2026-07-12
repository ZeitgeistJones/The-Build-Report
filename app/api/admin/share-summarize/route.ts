import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { getBriefShareEvidence } from '@/lib/buildBrief'
import { middleVoiceGuidanceForTweet } from '@/lib/middleVoice'
import { getNeedleShareEvidence } from '@/lib/needle'
import {
  TBR_SITE_URL,
  X_CHAR_LIMIT,
  enforceWeightedLimit,
  xWeightedLength,
  type ShareVoice,
} from '@/lib/xSharePosts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Hard floor for Under 280 variants — expand in a loop if below this. */
const X_TWEET_MIN_CHARS = 255
/** Prefer landing in this band when expanding. */
const X_TWEET_AIM_MIN = 265
const EXPAND_MAX_ATTEMPTS = 3
const EXPAND_MIN_GROWTH = 10

type Kind = 'brief' | 'needle'

/**
 * Write 3 under-280 tweet variants from the same upstream evidence as the homepage
 * Yesterday's Build / Needle columns — not from column prose.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const denied = await guardAdmin(req, (body as { password?: unknown }).password)
  if (denied) return denied

  const kind = (body as { kind?: string }).kind
  // Default false — site URL burns ~23 weighted chars; opt in from admin checkbox.
  const includeLink = (body as { includeLink?: boolean }).includeLink === true
  const voiceRaw = (body as { voice?: unknown }).voice
  const voice: ShareVoice = voiceRaw === 'normie' ? 'normie' : 'standard'
  const dateKey =
    typeof (body as { dateKey?: unknown }).dateKey === 'string'
      ? (body as { dateKey: string }).dateKey.trim()
      : ''

  if (kind !== 'brief' && kind !== 'needle') {
    return NextResponse.json({ ok: false, error: 'kind must be brief or needle' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  try {
    const evidence =
      kind === 'brief'
        ? await getBriefShareEvidence(dateKey || undefined)
        : await getNeedleShareEvidence(dateKey ? { dateKey } : {})

    if (!evidence?.evidenceText.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            kind === 'brief'
              ? 'No brief share evidence (GitHub stats / commits unavailable)'
              : 'No Needle share evidence (no rescored repos in the last 24h)',
        },
        { status: 404 },
      )
    }

    const variants = await summarizeToTweetVariants(kind, evidence.evidenceText, includeLink, voice)
    return NextResponse.json({
      ok: true,
      variants,
      lengths: variants.map(v => xWeightedLength(v)),
      evidenceMeta: {
        dateKey: evidence.dateKey,
        repoCount: evidence.repoCount,
        ...(kind === 'brief' && 'commitCount' in evidence
          ? { commitCount: evidence.commitCount }
          : {}),
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Summarize failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function summarizeToTweetVariants(
  kind: Kind,
  evidenceText: string,
  includeLink: boolean,
  voice: ShareVoice,
): Promise<[string, string, string]> {
  const label = kind === 'brief' ? "Yesterday's Build" : 'The Needle'
  const briefOpener = kind === 'brief' ? 'Yesterday:' : ''
  const urlRule = includeLink
    ? `Each variant MUST end with a blank line then exactly: ${TBR_SITE_URL}`
    : 'Do NOT include any URL.'

  const openerRule =
    kind === 'brief'
      ? `Each variant MUST start with exactly: Yesterday: (not a dated "Jul 11 Build:" or "Yesterday's Build — …" opener).`
      : 'Keep The Needle framing if useful; do not use a Yesterday opener.'

  const lengthRule = `HARD MINIMUM ${X_TWEET_MIN_CHARS} characters per variant (URLs count as 23). Prefer ${X_TWEET_AIM_MIN}–${X_CHAR_LIMIT}. Pack concrete detail from the evidence — not filler. Hard max ${X_CHAR_LIMIT}. Variants under ${X_TWEET_MIN_CHARS} are invalid.`

  const voiceBlock =
    voice === 'normie'
      ? `\nVoice (Plain English → Middle, not site Normie and not Full Normie ELI5):\n${middleVoiceGuidanceForTweet()}\nNote: Middle few-shots are register examples only — each tweet variant must still hit ${X_TWEET_MIN_CHARS}–${X_CHAR_LIMIT} characters even if some examples are shorter.\n`
      : `\nVoice: friendly, clear, light personality — no hype, no invented facts. You may keep normal product/tech wording.\n`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You write X/Twitter posts for The Build Report (independent community project scoring clawdbotatg repos).

Task: write THREE tweet-sized ${label} variants from the RAW EVIDENCE below. This is a fresh short take from the same upstream data the homepage column uses — NOT a rewrite of an existing column. Same facts across variants; different wording and emphasis. All three must land in the ${X_TWEET_MIN_CHARS}–${X_CHAR_LIMIT} character band. Name at most 1–2 repos if space allows. Do not invent facts not supported by the evidence.
${voiceBlock}
RAW EVIDENCE:
"""
${evidenceText.slice(0, 12000)}
"""

Hard rules:
- ${lengthRule}
- ${openerRule}
- ${urlRule}
- No hashtags unless already in the evidence.
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
      if (!s) s = evidenceText.slice(0, 200)
      s = finalizeVariant(s, { kind, briefOpener, includeLink })
      s = await expandUntilFloor(client, {
        kind,
        evidenceText,
        text: s,
        includeLink,
        briefOpener,
        voice,
      })
      return s
    }),
  )

  return cleaned as [string, string, string]
}

function finalizeVariant(
  text: string,
  opts: { kind: Kind; briefOpener: string; includeLink: boolean },
): string {
  let s = text.trim()
  if (opts.kind === 'brief' && opts.briefOpener) s = ensureBriefOpener(s, opts.briefOpener)
  if (opts.includeLink && !s.includes(TBR_SITE_URL)) {
    s = `${s.trim()}\n\n${TBR_SITE_URL}`
  }
  if (!opts.includeLink) {
    s = s.replace(new RegExp(`\\s*${TBR_SITE_URL.replace(/\./g, '\\.')}\\s*`, 'g'), '').trim()
  }
  return enforceWeightedLimit(s, X_CHAR_LIMIT)
}

async function expandUntilFloor(
  client: Anthropic,
  opts: {
    kind: Kind
    evidenceText: string
    text: string
    includeLink: boolean
    briefOpener: string
    voice: ShareVoice
  },
): Promise<string> {
  let s = opts.text
  for (let attempt = 0; attempt < EXPAND_MAX_ATTEMPTS; attempt++) {
    const len = xWeightedLength(s)
    if (len >= X_TWEET_MIN_CHARS) return s

    const needed = X_TWEET_MIN_CHARS - len
    const expanded = await expandVariant(client, {
      kind: opts.kind,
      evidenceText: opts.evidenceText,
      shortText: s,
      includeLink: opts.includeLink,
      briefOpener: opts.briefOpener,
      voice: opts.voice,
      currentLength: len,
      charsNeeded: needed,
    })
    const next = finalizeVariant(expanded, {
      kind: opts.kind,
      briefOpener: opts.briefOpener,
      includeLink: opts.includeLink,
    })
    const nextLen = xWeightedLength(next)
    if (nextLen < len + EXPAND_MIN_GROWTH) {
      return nextLen > len ? next : s
    }
    s = next
  }
  return s
}

function ensureBriefOpener(text: string, opener: string): string {
  let body = text.trim()
  body = body
    .replace(/^Yesterday'?s\s+Build\s*[—–\-:]\s*[A-Za-z]{3}\s+\d{1,2}\s*:?\s*/i, '')
    .replace(/^Yesterday'?s\s+Build\s*:?\s*/i, '')
    .replace(/^[A-Za-z]{3}\s+\d{1,2}\s+Build\s*:?\s*/i, '')
    .replace(/^Yesterday\s*:?\s*/i, '')
    .trim()
  if (body.toLowerCase().startsWith(opener.toLowerCase())) return body
  return `${opener} ${body}`
}

async function expandVariant(
  client: Anthropic,
  opts: {
    kind: Kind
    evidenceText: string
    shortText: string
    includeLink: boolean
    briefOpener: string
    voice: ShareVoice
    currentLength: number
    charsNeeded: number
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
      : 'Stay friendly and clear; add concrete detail from the evidence.'

  const prompt = `Lengthen this X post. It is currently ${opts.currentLength} characters — TOO SHORT.
You must add at least ${opts.charsNeeded}+ characters of real concrete detail from the RAW EVIDENCE (same facts only).
Target ${X_TWEET_AIM_MIN}–${X_CHAR_LIMIT} characters (URLs count as 23). Hard max ${X_CHAR_LIMIT}. Hard minimum ${X_TWEET_MIN_CHARS}.
No invented facts. No hashtags. No filler fluff.
${voiceBit}
${openerRule}
${urlRule}

RAW EVIDENCE:
"""
${opts.evidenceText.slice(0, 8000)}
"""

SHORT POST (${opts.currentLength} chars):
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
