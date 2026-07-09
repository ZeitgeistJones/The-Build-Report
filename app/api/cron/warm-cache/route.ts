import { NextRequest, NextResponse } from 'next/server'
import { getGitHubStats } from '@/lib/github'
import { syncGitHubStatsSnapshot } from '@/lib/githubStatsSnapshot'
import { syncBurnSnapshot } from '@/lib/burnSnapshot'
import { syncEthUsdRate } from '@/lib/ethUsdRate'
import { generateAndCacheDailyDigest, loadReposForBrief } from '@/lib/buildBrief'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Refresh GitHub stats + burn snapshots without running autoscore. */
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
    const stats = await getGitHubStats({ fresh: true })
    const githubSnapshotUpdatedAt = await syncGitHubStatsSnapshot(stats)
    const [burnSnapshot, ethUsd] = await Promise.all([
      syncBurnSnapshot(),
      syncEthUsdRate(),
    ])

    // daily-digest cron has been missing runs; warm-cache is reliable — keep the brief fresh here too.
    const repos = await loadReposForBrief(stats)
    const digest = await generateAndCacheDailyDigest(stats, repos)
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'brief-debug',hypothesisId:'A',location:'app/api/cron/warm-cache/route.ts',message:'warm-cache wrote daily digest',data:{dateKey:digest.dateKey,repoCount:digest.repoCount,commitCount:digest.commitCount,generatedAt:digest.generatedAt},timestamp:Date.now()})}).catch(()=>{});
    console.log('[brief-debug]', JSON.stringify({hypothesisId:'A',location:'warm-cache',event:'digest-ok',dateKey:digest.dateKey,repoCount:digest.repoCount,commitCount:digest.commitCount}))
    // #endregion

    return NextResponse.json({
      ok: true,
      totalRepos: stats.totalRepos,
      trackableRepos: stats.trackableRepos.length,
      rateLimited: stats.rateLimited,
      lastCommitAt: stats.lastCommitAt,
      githubSnapshotUpdatedAt,
      burnSnapshot,
      ethUsd,
      briefDateKey: digest.dateKey,
      briefRepoCount: digest.repoCount,
      briefCommitCount: digest.commitCount,
      briefGeneratedAt: digest.generatedAt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Warm cache cron failed'
    const status = message === 'rate_limited' ? 429 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
