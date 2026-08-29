import { NextRequest, NextResponse } from 'next/server'
import { getGitHubStats } from '@/lib/github'
import { syncGitHubStatsSnapshot } from '@/lib/githubStatsSnapshot'
import { syncBurnSnapshot } from '@/lib/burnSnapshot'
import { syncEthUsdRate } from '@/lib/ethUsdRate'
import {
  collectBuildActivityForMountainDay,
  generateAndCacheDailyDigest,
  loadReposForBrief,
  yesterdayMountainDateKey,
} from '@/lib/buildBrief'
import { generateAndCacheNeedle } from '@/lib/needle'
import { generateAllExternalDigests } from '@/lib/externalOwnerBrief'
import { runOvernightActiveRescores } from '@/lib/overnightActiveRescore'

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

  const startedAt = Date.now()

  try {
    const stats = await getGitHubStats({ fresh: true })
    const githubSnapshotUpdatedAt = await syncGitHubStatsSnapshot(stats)
    const [burnSnapshot, ethUsd] = await Promise.all([
      syncBurnSnapshot(),
      syncEthUsdRate(),
    ])

    const repos = await loadReposForBrief(stats)
    const editionKey = yesterdayMountainDateKey()
    const activity = collectBuildActivityForMountainDay(stats, repos, editionKey)

    // Homepage columns before The Daily Loop heal.
    const digest = await generateAndCacheDailyDigest(stats, repos, editionKey)
    const overnight = await runOvernightActiveRescores({
      stats,
      dateKey: editionKey,
      batchSize: 3,
      refreshNeedle: false,
    }).catch(err => {
      console.error('[warm-cache] overnight rescore failed', err)
      return null
    })

    const needle = await generateAndCacheNeedle({
      dateKey: editionKey,
      force: Boolean(overnight?.scored.length),
      activity,
    }).catch(err => {
      console.error('[warm-cache] needle generation failed', err)
      return null
    })

    // Heal only missing / rateLimited-stuck desks — do not re-scan every quiet desk.
    // Budget high enough for a full desk pass; batch no longer aborts on 429s.
    const external = await generateAllExternalDigests({
      dateKey: editionKey,
      healOnly: true,
      recheckQuiet: false,
      maxAttempts: 24,
      deadlineMs: startedAt + 240_000,
    }).catch(err => {
      console.error('[warm-cache] external digests failed', err)
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
      overnight,
      externalBriefs: external,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Warm cache failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
