import { NextRequest, NextResponse } from 'next/server'
import { scanNewEpisodes } from '@/lib/podcastMentions'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await scanNewEpisodes()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Podcast scan cron failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
