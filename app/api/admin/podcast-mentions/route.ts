import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import {
  clearScannedEpisodes,
  scanNewEpisodes,
  scanNextUnscanned,
} from '@/lib/podcastMentions'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const action = (body?.action as string | undefined) ?? (body?.rescanAll ? 'rescanAll' : 'scanAll')

  try {
    if (action === 'clearHistory' || action === 'clearScanned') {
      const cleared = await clearScannedEpisodes()
      return NextResponse.json({ ok: true, cleared })
    }

    if (action === 'scanOne') {
      const result = await scanNextUnscanned()
      return NextResponse.json({ ok: true, ...result })
    }

    if (action === 'rescanAll') {
      const result = await scanNewEpisodes({ rescanAll: true })
      return NextResponse.json({ ok: true, ...result })
    }

    // scanAll / scanNew — only unscanned episodes
    const result = await scanNewEpisodes({ rescanAll: false })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Podcast scan failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
