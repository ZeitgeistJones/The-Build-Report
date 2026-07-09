import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import {
  getPendingMentions,
  getCandidateMentions,
  publishMention,
  dismissMention,
  addContextToCandidate,
  confirmCandidate,
  groupCandidatesIntoThread,
  updatePendingWriteup,
  regeneratePendingWriteup,
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

  if (action === 'groupThread') {
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]).filter(Boolean) : []
    const result = await groupCandidatesIntoThread(ids)
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, id: result.id })
  }

  if (action === 'updateWriteup') {
    const id = body?.id as string
    const writeup = (body?.writeup as string) ?? ''
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const success = await updatePendingWriteup(id, writeup)
    return NextResponse.json({ ok: success })
  }

  if (action === 'regenerateWriteup') {
    const id = body?.id as string
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const writeup = await regeneratePendingWriteup(id)
    if (!writeup) return NextResponse.json({ ok: false, error: 'Regenerate failed' }, { status: 400 })
    return NextResponse.json({ ok: true, writeup })
  }

  if (action === 'publish') {
    const id = body?.id as string
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })
    const writeup = typeof body?.writeup === 'string' ? body.writeup : undefined
    const success = await publishMention(id, writeup)
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
