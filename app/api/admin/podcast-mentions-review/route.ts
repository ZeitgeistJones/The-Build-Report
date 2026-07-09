import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import {
  getPendingMentions,
  getCandidateMentions,
  publishMention,
  dismissMention,
  addContextToCandidate,
  confirmCandidate,
  getOverheardMode,
  setOverheardMode,
} from '@/lib/podcastMentions'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const action = body?.action as string

  if (action === 'list') {
    const pending = await getPendingMentions()
    const candidates = await getCandidateMentions()
    const mode = await getOverheardMode()
    return NextResponse.json({ ok: true, pending, candidates, mode })
  }

  if (action === 'getMode') {
    const mode = await getOverheardMode()
    return NextResponse.json({ ok: true, mode })
  }

  if (action === 'setMode') {
    const mode = body?.mode === 'manual' ? 'manual' : 'automatic'
    await setOverheardMode(mode)
    return NextResponse.json({ ok: true, mode })
  }

  if (action === 'addContext') {
    const id = body?.id as string
    const context = (body?.context as string) ?? ''
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const success = await addContextToCandidate(id, context)
    return NextResponse.json({ ok: success })
  }

  if (action === 'confirm') {
    const id = body?.id as string
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const success = await confirmCandidate(id)
    return NextResponse.json({ ok: success })
  }

  if (action === 'publish') {
    const id = body?.id as string
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const success = await publishMention(id)
    if (success) {
      const { generateAndCacheOverheard } = await import('@/lib/overheard')
      await generateAndCacheOverheard().catch(() => null)
    }
    return NextResponse.json({ ok: success })
  }

  if (action === 'dismiss') {
    const id = body?.id as string
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const success = await dismissMention(id)
    return NextResponse.json({ ok: success })
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}
