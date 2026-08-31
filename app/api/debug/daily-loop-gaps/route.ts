import { NextRequest, NextResponse } from 'next/server'
import {
  EXTERNAL_BRIEF_ACCOUNTS,
  listDailyLoopDeskGaps,
} from '@/lib/externalOwnerBrief'
import { yesterdayMountainDateKey } from '@/lib/buildBrief'

export const dynamic = 'force-dynamic'

/**
 * Gated desk-gap readout for The Daily Loop.
 * Use CRON_SECRET as ?key= or Authorization Bearer.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const key = req.nextUrl.searchParams.get('key')
  const auth = req.headers.get('authorization')
  const allowed = key === cronSecret || auth === `Bearer ${cronSecret}`
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const dateKey = req.nextUrl.searchParams.get('date') || yesterdayMountainDateKey()
  const gaps = await listDailyLoopDeskGaps(dateKey)

  return NextResponse.json({
    ok: true,
    dateKey: gaps.dateKey,
    deskCount: EXTERNAL_BRIEF_ACCOUNTS.length,
    missing: gaps.missing,
    stuck: gaps.stuck,
    complete: gaps.missing.length === 0 && gaps.stuck.length === 0,
  })
}
