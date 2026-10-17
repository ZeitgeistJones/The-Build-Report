import { NextRequest, NextResponse } from 'next/server'
import { collectClawdMentions } from '@/lib/clawdMentions'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Daily: collect new $CLAWD mentions from Farcaster, Bluesky, HN, GitHub, podcasts. */
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
    const result = await collectClawdMentions({ deadlineMs: Date.now() + 90_000 })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Mention collection failed'
    console.error('[clawd-mentions] cron failed', err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
