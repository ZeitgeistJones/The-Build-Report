import { NextRequest, NextResponse } from 'next/server'
import { loadGitHubStatsForCron } from '@/lib/githubStatsSnapshot'
import { generateAndCacheDailyDigest, loadReposForBrief, yesterdayMountainDateKey } from '@/lib/buildBrief'
import { generateAndCacheNeedle } from '@/lib/needle'

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
    const stats = await loadGitHubStatsForCron()
    if (!stats) {
      return NextResponse.json({ ok: false, error: 'No GitHub stats snapshot available' }, { status: 503 })
    }

    const repos = await loadReposForBrief(stats)
    const editionKey = yesterdayMountainDateKey()
    const digest = await generateAndCacheDailyDigest(stats, repos, editionKey)
    const needle = await generateAndCacheNeedle({ dateKey: editionKey }).catch(err => {
      console.error('[daily-digest] needle generation failed', err)
      return null
    })
    return NextResponse.json({
      ok: true,
      dateKey: digest.dateKey,
      repoCount: digest.repoCount,
      commitCount: digest.commitCount,
      generatedAt: digest.generatedAt,
      needleDateKey: needle?.dateKey ?? null,
      needleRepoCount: needle?.repoCount ?? 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Daily digest cron failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
