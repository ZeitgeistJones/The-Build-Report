import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import {
  TBR_SITE_URL,
  X_CHAR_LIMIT,
  enforceWeightedLimit,
  xWeightedLength,
} from '@/lib/xSharePosts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
  const includeLink = (body as { includeLink?: boolean }).includeLink !== false

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
    const variants = await summarizeToTweetVariants(kind, text, includeLink)
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
): Promise<[string, string, string]> {
  const label = kind === 'brief' ? "Yesterday's Build" : 'The Needle'
  const urlRule = includeLink
    ? `Each variant MUST end with a blank line then exactly: ${TBR_SITE_URL}`
    : 'Do NOT include any URL.'

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You write X/Twitter posts for The Build Report (independent community project scoring clawdbotatg repos).

Task: turn this full ${label} draft into THREE different tweet-sized variants. Same facts; different wording, emphasis, and length. Friendly, clear, light personality — no hype, no invented facts. Name at most 1–2 repos if space allows.

SOURCE DRAFT:
"""
${sourceText.slice(0, 6000)}
"""

Hard rules:
- Each variant must fit under ${X_CHAR_LIMIT} characters (URLs count as 23 — keep that in mind).
- ${urlRule}
- No hashtags unless already in the source.
- Return ONLY valid JSON (no markdown fences):
{ "variants": ["...", "...", "..."] }
`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
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

  const cleaned = parsed.variants.slice(0, 3).map(v => {
    let s = typeof v === 'string' ? v.trim() : ''
    if (!s) s = sourceText.slice(0, 200)
    if (includeLink && !s.includes(TBR_SITE_URL)) {
      s = `${s.trim()}\n\n${TBR_SITE_URL}`
    }
    if (!includeLink) {
      s = s.replace(new RegExp(`\\s*${TBR_SITE_URL.replace(/\./g, '\\.')}\\s*`, 'g'), '').trim()
    }
    return enforceWeightedLimit(s, X_CHAR_LIMIT)
  }) as [string, string, string]

  return cleaned
}
