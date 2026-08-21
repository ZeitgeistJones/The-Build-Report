import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { BULK_REGEN_DEFAULT_BATCH, BULK_REGEN_MAX_BATCH } from '@/lib/bulkRegenConfig'
import {
  getBehindRescoreStatus,
  runBehindRescoreBatch,
} from '@/lib/staleRescoreBatch'
import { scheduleNeedleRefreshAfterRescore } from '@/lib/rescorePipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Admin: batch-rescore scored repos with commits since last score
 * (“Awaiting overnight” / old earn-Rescore set).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password
  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const action = body?.action as string

  if (action === 'status') {
    try {
      const status = await getBehindRescoreStatus()
      return NextResponse.json({ ok: true, ...status })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Behind status failed'
      console.error('[admin/rescore-behind] status', message)
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
  }

  if (action === 'batch') {
    const rawSlugs = Array.isArray(body?.slugs) ? body.slugs : []
    const slugs = rawSlugs
      .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s: string) => s.trim())

    if (slugs.length === 0) {
      return NextResponse.json({ ok: false, error: 'Missing slugs' }, { status: 400 })
    }

    const limit =
      typeof body?.limit === 'number'
        ? Math.min(Math.max(1, body.limit), BULK_REGEN_MAX_BATCH)
        : BULK_REGEN_DEFAULT_BATCH

    const refreshNeedle = body?.refreshNeedle === true

    try {
      const result = await runBehindRescoreBatch({ slugs, limit })
      if (refreshNeedle) {
        scheduleNeedleRefreshAfterRescore()
      }
      return NextResponse.json({ ok: true, ...result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Behind batch failed'
      console.error('[admin/rescore-behind] batch', message)
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}
