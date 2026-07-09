import { NextRequest, NextResponse } from 'next/server'
import { getGitHubStats } from '@/lib/github'
import { syncGitHubStatsSnapshot } from '@/lib/githubStatsSnapshot'
import { syncBurnSnapshot } from '@/lib/burnSnapshot'
import { syncEthUsdRate } from '@/lib/ethUsdRate'
import { generateAndCacheDailyDigest, loadReposForBrief } from '@/lib/buildBrief'
import { generateAndCacheNeedle } from '@/lib/needle'

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

    // Keep Yesterday's build fresh even when the dedicated daily-digest cron misses a run.
    const repos = await loadReposForBrief(stats)
    const digest = await generateAndCacheDailyDigest(stats, repos)
    const needle = await generateAndCacheNeedle().catch(err => {
      console.error('[warm-cache] needle generation failed', err)
      return null
    })

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
      needleDateKey: needle?.dateKey ?? null,
      needleRepoCount: needle?.repoCount ?? 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Warm cache cron failed'
    const status = message === 'rate_limited' ? 429 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
