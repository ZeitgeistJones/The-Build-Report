import { NextRequest, NextResponse } from 'next/server'
import { getGitHubStats } from '@/lib/github'
import { syncGitHubStatsSnapshot } from '@/lib/githubStatsSnapshot'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Full GitHub stats snapshot refresh only (no digest / needle / burns). */
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

    return NextResponse.json({
      ok: true,
      totalRepos: stats.totalRepos,
      trackableRepos: stats.trackableRepos.length,
      rateLimited: stats.rateLimited,
      lastCommitAt: stats.lastCommitAt,
      lastCommitRepo: stats.lastCommitRepo,
      githubSnapshotUpdatedAt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'GitHub snapshot cron failed'
    const status = message === 'rate_limited' ? 429 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
