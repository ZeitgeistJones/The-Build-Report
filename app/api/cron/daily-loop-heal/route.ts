import { NextRequest, NextResponse } from 'next/server'
import { healDailyLoopEdition, listDailyLoopDeskGaps } from '@/lib/externalOwnerBrief'
import { yesterdayMountainDateKey } from '@/lib/buildBrief'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Midday / evening catch-up for Daily Loop desks that warm-cache or daily-digest
 * left missing or stuck (rate-limited). Safe to run often — no-ops when complete.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const editionKey = yesterdayMountainDateKey()

  try {
    const before = await listDailyLoopDeskGaps(editionKey)
    if (before.missing.length === 0 && before.stuck.length === 0) {
      return NextResponse.json({
        ok: true,
        dateKey: editionKey,
        healed: false,
        missingBefore: [],
        stuckBefore: [],
      })
    }

    const heal = await healDailyLoopEdition({
      dateKey: editionKey,
      maxAttempts: 16,
      deadlineMs: startedAt + 100_000,
    })

    const after = await listDailyLoopDeskGaps(editionKey)

    return NextResponse.json({
      ok: true,
      dateKey: editionKey,
      healed: true,
      missingBefore: heal.missingBefore,
      stuckBefore: heal.stuckBefore,
      missingAfter: after.missing,
      stuckAfter: after.stuck,
      results: heal.results,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Daily Loop heal failed'
    console.error('[daily-loop-heal] failed', err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
