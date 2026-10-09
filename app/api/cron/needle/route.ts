import { NextRequest, NextResponse } from 'next/server'
import { getGitHubStats } from '@/lib/github'
import {
  collectBuildActivityForMountainDay,
  loadReposForBrief,
  yesterdayMountainDateKey,
} from '@/lib/buildBrief'
import { generateAndCacheNeedle } from '@/lib/needle'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    const force = req.nextUrl.searchParams.get('force') === '1'
    const dateKey = yesterdayMountainDateKey()
    const stats = await getGitHubStats({ fresh: true })
    const repos = await loadReposForBrief(stats)
    const activity = collectBuildActivityForMountainDay(stats, repos, dateKey)
    const needle = await generateAndCacheNeedle({ dateKey, force, activity })
    return NextResponse.json({
      ok: true,
      generated: Boolean(needle),
      repoCount: needle?.repoCount ?? 0,
      dateKey: needle?.dateKey ?? null,
      source: needle?.source ?? null,
      textPreview: needle?.text?.slice(0, 220) ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Needle generation failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
