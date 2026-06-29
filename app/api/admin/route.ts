import { NextRequest, NextResponse } from 'next/server'
import { getAdminNotes, setAdminNote, verifyAdminPassword } from '@/lib/admin'
import { flushAutoScore, listCachedAutoScores } from '@/lib/autoscore'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, password, repoId, note } = body

  const ok = await verifyAdminPassword(password)
  if (!ok) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  if (action === 'auth') {
    const notes = await getAdminNotes()
    const autoScored = await listCachedAutoScores()
    return NextResponse.json({ ok: true, notes, autoScored })
  }

  if (action === 'save') {
    await setAdminNote(repoId, note ?? '')
    return NextResponse.json({ ok: true })
  }

  if (action === 'flush') {
    // Clear a cached auto-score so it gets re-inferred on next page load
    await flushAutoScore(repoId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}
