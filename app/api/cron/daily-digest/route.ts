import { NextRequest, NextResponse } from 'next/server'
import { getGitHubStatsForDisplay } from '@/lib/githubStatsSnapshot'
import { generateAndCacheDailyDigest, loadReposForBrief } from '@/lib/buildBrief'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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
    const stats = await getGitHubStatsForDisplay()
    if (!stats) {
      return NextResponse.json({ ok: false, error: 'No GitHub stats snapshot available' }, { status: 503 })
    }

    const repos = await loadReposForBrief(stats)
    const digest = await generateAndCacheDailyDigest(stats, repos)
    return NextResponse.json({
      ok: true,
      dateKey: digest.dateKey,
      repoCount: digest.repoCount,
      commitCount: digest.commitCount,
      generatedAt: digest.generatedAt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Daily digest cron failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
