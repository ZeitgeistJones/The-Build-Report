import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminPassword } from '@/lib/admin'
import { listCachedAutoScores } from '@/lib/autoscore'
import { BULK_REGEN_DEFAULT_BATCH, BULK_REGEN_MAX_BATCH } from '@/lib/bulkRegenConfig'
import {
  exportBaselineBackup,
  getBulkRegenStatus,
  runBulkRegenerateBatch,
} from '@/lib/bulkRegen'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const action = body?.action as string

  if (action === 'status') {
    const status = await getBulkRegenStatus()
    return NextResponse.json({ ok: true, ...status })
  }

  if (action === 'exportBaseline') {
    const cachedSlugs = await listCachedAutoScores()
    const backup = exportBaselineBackup(cachedSlugs)
    return NextResponse.json({ ok: true, backup })
  }

  if (action === 'regenerateBatch') {
    const flushFirst = body?.confirmFlush === true
    if (flushFirst && body?.acknowledgeFlush !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Bulk regen with flush requires acknowledgeFlush: true after downloading baseline backup.',
        },
        { status: 400 },
      )
    }

    const offset = typeof body?.offset === 'number' ? body.offset : 0
    const overwritePaid = body?.overwritePaid === true
    const limit =
      typeof body?.limit === 'number'
        ? Math.min(Math.max(1, body.limit), BULK_REGEN_MAX_BATCH)
        : BULK_REGEN_DEFAULT_BATCH

    try {
      const result = await runBulkRegenerateBatch({ flushFirst, offset, limit, overwritePaid })
      if (result.nextOffset === null) {
        const { getGitHubStats } = await import('@/lib/github')
        const { syncGitHubStatsSnapshot } = await import('@/lib/githubStatsSnapshot')
        const fresh = await getGitHubStats({ fresh: true })
        await syncGitHubStatsSnapshot(fresh)
      }
      return NextResponse.json({ ok: true, ...result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bulk regenerate batch failed'
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}
