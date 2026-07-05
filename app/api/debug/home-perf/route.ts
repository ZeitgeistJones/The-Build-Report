import { NextResponse } from 'next/server'
import {
  getGitHubStatsSnapshotDiagnostics,
  loadGitHubStatsForPage,
} from '@/lib/githubStatsSnapshot'
import { REPOS } from '@/lib/scores'
import { getAdminNotes } from '@/lib/admin'
import { getCachedAutoScoresForSlugs } from '@/lib/autoscore'
import { getAllCollectionSlugs, getTrackableForceIncludeSet } from '@/lib/repoCollections'
import { getExcludedSlugs } from '@/lib/repoExclude'
import { cacheLookupSlugs } from '@/lib/repoOrder'
import { getRescoreBurnStats } from '@/lib/rescoreBurns'
import { getRescoreSummaries } from '@/lib/rescoreSummaries'
import { getBuildBrief } from '@/lib/buildBrief'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function timed<T>(label: string, timings: Record<string, number>, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  try {
    return await fn()
  } finally {
    timings[label] = Date.now() - start
  }
}

/** Mirrors homepage data fetches with per-step timings. */
export async function GET() {
  const timings: Record<string, number> = {}
  const totalStart = Date.now()
  let statsSource: 'snapshot' | 'live' | 'none' = 'none'

  const snapshotDiag = await getGitHubStatsSnapshotDiagnostics()

  const [rescoreBurns, buildBrief] = await timed('parallel_initial', timings, () =>
    Promise.all([
      getRescoreBurnStats().catch(() => null),
      getBuildBrief().catch(() => null),
    ]),
  )

  let stats: Awaited<ReturnType<typeof loadGitHubStatsForPage>>['stats'] = null
  const githubStart = Date.now()
  const loaded = await loadGitHubStatsForPage()
  stats = loaded.stats
  statsSource = loaded.source
  if (loaded.source === 'live') timings.github_live_fallback = Date.now() - githubStart
  else timings.github_load = Date.now() - githubStart

  const [adminNotes, excludedMap, collectionSlugs, forceIncludeSet] = await timed('parallel_meta', timings, () =>
    Promise.all([
      getAdminNotes(),
      getExcludedSlugs(),
      getAllCollectionSlugs().catch(() => ({ 'cv-related': [] as string[], 'clawd-gated': [] as string[] })),
      getTrackableForceIncludeSet().catch(() => new Set<string>()),
    ]),
  )

  const excludedSlugs = new Set(Object.keys(excludedMap).filter(k => excludedMap[k]))
  const trackableGithub = stats?.trackableRepos ?? []
  const cacheSlugs = cacheLookupSlugs(REPOS, trackableGithub, excludedSlugs)

  const autoScoredRaw = await timed('autoscore_cache', timings, () =>
    cacheSlugs.length > 0 ? getCachedAutoScoresForSlugs(cacheSlugs) : Promise.resolve([]),
  )

  const repoSlugs = [...new Set([
    ...REPOS.map(r => r.githubSlug),
    ...autoScoredRaw.map(r => r.githubSlug),
  ])]

  const rescoreSummaries = await timed('rescore_summaries', timings, () =>
    getRescoreSummaries(repoSlugs).catch(() => ({})),
  )

  timings.totalMs = Date.now() - totalStart

  console.log('[home-perf]', JSON.stringify({ timings, statsSource, slugCount: cacheSlugs.length }))

  return NextResponse.json({
    timings,
    statsSource,
    snapshotBefore: snapshotDiag,
    snapshotAfter: await getGitHubStatsSnapshotDiagnostics(),
    slugCount: cacheSlugs.length,
    autoScoredCount: autoScoredRaw.length,
    rescoreSummaryCount: Object.keys(rescoreSummaries).length,
    hasBurns: Boolean(rescoreBurns?.clawdBurnedOnChain),
    hasBrief: Boolean(buildBrief?.text),
    hasAdminNotes: Object.keys(adminNotes).length,
  })
}
