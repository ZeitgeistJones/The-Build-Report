import { NextRequest, NextResponse } from 'next/server'
import { runAutoscorePipeline } from '@/lib/autoscorePipeline'
import { generateAndCacheBuildBrief, loadReposForBrief } from '@/lib/buildBrief'
import { syncBurnSnapshot } from '@/lib/burnSnapshot'
import { syncGitHubStatsSnapshot } from '@/lib/githubStatsSnapshot'

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
    const repos = await loadReposForBrief(result.stats)
    const brief = await generateAndCacheBuildBrief(result.stats, repos)
    const burnSnapshot = await syncBurnSnapshot()
    return NextResponse.json({
      ok: true,
      ...result,
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
