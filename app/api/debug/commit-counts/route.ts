import { NextRequest, NextResponse } from 'next/server'
import { guardDebugRoute } from '@/lib/debugAuth'
import { loadGitHubStatsForPage, getGitHubStatsSnapshotUpdatedAt } from '@/lib/githubStatsSnapshot'
import { inferCommitsScanned, countCommitsWithinHours, fetchTrackableRepoPushes } from '@/lib/github'
import { REPOS } from '@/lib/scores'
import { getCachedAutoScoresForSlugs } from '@/lib/autoscore'
import { cacheLookupSlugs } from '@/lib/repoOrder'
import { getExcludedSlugs } from '@/lib/repoExclude'
import {
  countCommitsSinceScore,
  isScoredAfterLastKnownActivity,
  parseScoredAtMs,
} from '@/lib/commitsSinceScore'

export const dynamic = 'force-dynamic'

const SAMPLE_SLUGS = [
  'slop-computer-live',
  'clawd-harness',
  'clawd-clipper',
  'slop-circle',
  'private-voting',
]

function hoursAgo(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 3600000
}

/** Diagnose 24h + commits-since-scored for sample repos. */
export async function GET(req: NextRequest) {
  const denied = guardDebugRoute(req)
  if (denied) return denied

  const { stats, source } = await loadGitHubStatsForPage()
  const snapshotUpdatedAt = await getGitHubStatsSnapshotUpdatedAt()

  const excludedMap = await getExcludedSlugs()
  const excludedSlugs = new Set(Object.keys(excludedMap).filter(k => excludedMap[k]))
  const trackable = stats?.trackableRepos ?? []
  const cacheSlugs = cacheLookupSlugs(REPOS, trackable, excludedSlugs)
  const autoScored = cacheSlugs.length > 0 ? await getCachedAutoScoresForSlugs(cacheSlugs) : []
  const scoredBySlug = new Map(autoScored.map(r => [r.githubSlug, r]))
  for (const r of REPOS) scoredBySlug.set(r.githubSlug, r)

  const livePushes = await fetchTrackableRepoPushes().catch(
    () => new Map<string, { pushedAt: string }>(),
  )

  const samples = SAMPLE_SLUGS.map(slug => {
    const activity = stats?.repoActivity[slug]
    const repo = scoredBySlug.get(slug)
    const pushedAt =
      trackable.find(t => t.name === slug)?.pushedAt ?? activity?.pushedAt ?? null
    const ts = activity?.commitTimestamps ?? []
    const newest = ts[0] ?? activity?.lastCommitAt ?? null
    const oldest = ts.length ? ts[ts.length - 1] : null
    const scoredAt = repo?.scoredAt ?? null
    const scoredMs = parseScoredAtMs(scoredAt)
    const sinceScore = countCommitsSinceScore(scoredAt, ts, {
      lastCommitAt: activity?.lastCommitAt ?? null,
      pushedAt,
    })
    const afterScoredInSnapshot =
      scoredMs != null
        ? ts.filter(t => new Date(t).getTime() > scoredMs).length
        : null

    return {
      slug,
      statsSource: source,
      commitsScanned: activity ? inferCommitsScanned(activity) : null,
      commits24hStored: activity?.commits24h ?? null,
      commits24hFromTs: ts.length ? countCommitsWithinHours(ts, 24) : null,
      commits30d: activity?.commits30d ?? null,
      commitTimestampsCount: ts.length,
      newestCommitAt: newest,
      oldestCommitAt: oldest,
      newestCommitHoursAgo: newest ? Math.round(hoursAgo(newest) * 10) / 10 : null,
      pushedAt,
      pushedHoursAgo: pushedAt ? Math.round(hoursAgo(pushedAt) * 10) / 10 : null,
      lastCommitAt: activity?.lastCommitAt ?? null,
      scoredAt,
      scoredMs,
      afterScoredInSnapshot,
      sinceScore,
      pushedAfterScored:
        scoredMs != null && pushedAt
          ? new Date(pushedAt).getTime() > scoredMs
          : null,
      lastCommitAfterScored:
        scoredMs != null && activity?.lastCommitAt
          ? new Date(activity.lastCommitAt).getTime() > scoredMs
          : null,
      hasCommitAfterScoreWouldUse:
        scoredMs != null
          ? [activity?.lastCommitAt, pushedAt].some(
              raw => raw && new Date(raw).getTime() > scoredMs!,
            )
          : null,
      scoredAfterLastKnownActivity: isScoredAfterLastKnownActivity(scoredAt, ts, {
        lastCommitAt: activity?.lastCommitAt ?? null,
        pushedAt,
      }),
      livePushedAt: livePushes.get(slug)?.pushedAt ?? null,
      livePushedAfterSnapshot:
        pushedAt && livePushes.get(slug)?.pushedAt
          ? new Date(livePushes.get(slug)!.pushedAt).getTime() > new Date(pushedAt).getTime()
          : null,
    }
  })

  const payload = {
    snapshotUpdatedAt,
    statsSource: source,
    rateLimited: stats?.rateLimited ?? null,
    samples,
  }

  return NextResponse.json(payload)
}
