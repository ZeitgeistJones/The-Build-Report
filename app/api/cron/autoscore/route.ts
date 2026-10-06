import { NextRequest, NextResponse } from 'next/server'
import { runAutoscorePipeline } from '@/lib/autoscorePipeline'
import {
  generateAndCacheBuildBrief,
  loadReposForBrief,
  yesterdayMountainDateKey,
} from '@/lib/buildBrief'
import { syncBurnSnapshot } from '@/lib/burnSnapshot'
import { syncGitHubStatsSnapshot } from '@/lib/githubStatsSnapshot'
import { runOvernightActiveRescores } from '@/lib/overnightActiveRescore'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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
    const result = await runAutoscorePipeline({ fresh: true })
    await syncGitHubStatsSnapshot(result.stats)

    // Midday free-tier slot: chip away at weeks-overdue grades (instant-wallet class).
    const overnight = await runOvernightActiveRescores({
      stats: result.stats,
      dateKey: yesterdayMountainDateKey(),
      batchSize: 2,
      refreshNeedle: false,
    }).catch(err => {
      console.error('[autoscore] overdue rescore catch-up failed', err)
      return null
    })

    const repos = await loadReposForBrief(result.stats)
    const brief = await generateAndCacheBuildBrief(result.stats, repos)
    const burnSnapshot = await syncBurnSnapshot()
    return NextResponse.json({
      ok: true,
      ...result,
      overnight,
      briefGenerated: true,
      briefRepoCount: brief.repoCount,
      briefCommitCount: brief.commitCount,
      burnSnapshot,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Autoscore cron failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
