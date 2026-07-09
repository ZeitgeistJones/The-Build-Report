import { NextRequest, NextResponse } from 'next/server'
import { generateAndCacheOverheard } from '@/lib/overheard'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    const overheard = await generateAndCacheOverheard()
    return NextResponse.json({ ok: true, generated: Boolean(overheard) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Overheard cron failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
