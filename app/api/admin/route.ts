import { NextRequest, NextResponse } from 'next/server'
import { getAdminNotes, setAdminNote, verifyAdminPassword } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, password, repoId, note } = body

  const ok = await verifyAdminPassword(password)
  if (!ok) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  if (action === 'auth') {
    const notes = await getAdminNotes()
    return NextResponse.json({ ok: true, notes })
  }

  if (action === 'save') {
    await setAdminNote(repoId, note ?? '')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}
