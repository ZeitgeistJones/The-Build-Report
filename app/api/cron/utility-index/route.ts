import { NextRequest, NextResponse } from 'next/server'
import { refreshUtilityIndex } from '@/lib/utilityIndex'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Cheap CLAWD/CV utility index refresh — metadata sync + capped Haiku enrichment. */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const auth = req.headers.get('authorization')
  const key = req.nextUrl.searchParams.get('key')
  if (auth !== `Bearer ${cronSecret}` && key !== cronSecret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await refreshUtilityIndex()
    const status = result.rateLimited ? 429 : result.ok ? 200 : 500
    return NextResponse.json(result, { status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'utility-index cron failed'
    const status = message === 'rate_limited' ? 429 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
