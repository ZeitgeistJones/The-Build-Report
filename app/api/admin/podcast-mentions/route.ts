import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { scanNewEpisodes } from '@/lib/podcastMentions'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  try {
    const result = await scanNewEpisodes()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Podcast scan failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
