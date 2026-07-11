import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import {
  generateSpottedDraft,
  getDraftEntries,
  getPublishedEntries,
  publishEntry,
  dismissEntry,
  takeDownEntry,
  removeFromArchives,
} from '@/lib/spotted'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const action = body?.action as string

  if (action === 'generate') {
    const { tweetUrl, tweetText, accountContext, extraContext, repoSlug } = body
    if (!tweetUrl || !tweetText) {
      return NextResponse.json({ ok: false, error: 'Missing tweetUrl or tweetText' }, { status: 400 })
    }
    const entry = await generateSpottedDraft({
      tweetUrl,
      tweetText,
      accountContext: accountContext ?? '',
      extraContext: extraContext ?? '',
      repoSlug: repoSlug || null,
    })
    if (!entry) return NextResponse.json({ ok: false, error: 'Draft generation failed' }, { status: 500 })
    return NextResponse.json({ ok: true, entry })
  }

  if (action === 'list') {
    const [drafts, published] = await Promise.all([getDraftEntries(), getPublishedEntries()])
    return NextResponse.json({ ok: true, drafts, published })
  }

  if (action === 'publish') {
    const id = body?.id as string
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const writeup = typeof body?.writeup === 'string' ? body.writeup : undefined
    const success = await publishEntry(id, writeup)
    return NextResponse.json({ ok: success })
  }

  if (action === 'dismiss') {
    const id = body?.id as string
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const success = await dismissEntry(id)
    return NextResponse.json({ ok: success })
  }

  if (action === 'takeDown') {
    const id = body?.id as string
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const success = await takeDownEntry(id)
    return NextResponse.json({ ok: success })
  }

  if (action === 'removeFromArchives') {
    const id = body?.id as string
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const success = await removeFromArchives(id)
    return NextResponse.json({ ok: success })
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}
