import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { getPendingMentions, publishMention, dismissMention } from '@/lib/podcastMentions'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const action = body?.action as string

  if (action === 'list') {
    const pending = await getPendingMentions()
    return NextResponse.json({ ok: true, pending })
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
