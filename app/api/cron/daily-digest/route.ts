import { NextRequest, NextResponse } from 'next/server'
import { loadGitHubStatsForCron } from '@/lib/githubStatsSnapshot'
import {
  collectBuildActivityForMountainDay,
  generateAndCacheDailyDigest,
  loadReposForBrief,
  yesterdayMountainDateKey,
} from '@/lib/buildBrief'
import { generateAndCacheNeedle } from '@/lib/needle'
import { generateAllExternalDigests } from '@/lib/externalOwnerBrief'
import { collectMcpWire } from '@/lib/mcpWire'
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

  const startedAt = Date.now()

  try {
    const stats = await loadGitHubStatsForCron()
    if (!stats) {
      return NextResponse.json({ ok: false, error: 'No GitHub stats snapshot available' }, { status: 503 })
    }

    const repos = await loadReposForBrief(stats)
    const editionKey = yesterdayMountainDateKey()
    const activity = collectBuildActivityForMountainDay(stats, repos, editionKey)

    // CLAWD homepage columns first — The Daily Loop must not starve these again.
    const digest = await generateAndCacheDailyDigest(stats, repos, editionKey)
    const needle = await generateAndCacheNeedle({
      dateKey: editionKey,
      force: true,
      activity,
    }).catch(err => {
      console.error('[daily-digest] needle generation failed', err)
      return null
    })

    const overnight = await runOvernightActiveRescores({
      stats,
      dateKey: editionKey,
      batchSize: 3,
      refreshNeedle: false,
    }).catch(err => {
      console.error('[daily-digest] overnight rescore failed', err)
      return null
    })

    // The Daily Loop (secondary digests): budgeted so Base/rate-limits cannot blank the paper.
    const external = await generateAllExternalDigests({
      dateKey: editionKey,
      recheckQuiet: false,
      maxAttempts: 12,
      deadlineMs: startedAt + 240_000,
    }).catch(err => {
      console.error('[daily-digest] external digests failed', err)
      return null
    })

    const wire = await collectMcpWire(editionKey).catch(err => {
      console.error('[daily-digest] mcp wire failed', err)
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
      overnight,
      externalBriefs: external,
      mcpWire: wire ? { status: wire.status, printed: wire.items.length, total: wire.totalChanges } : null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Daily digest cron failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
