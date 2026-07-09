import { timeAgo, inferCommitsScanned } from '@/lib/github'
import { loadGitHubStatsForPage, getGitHubStatsSnapshotUpdatedAt } from '@/lib/githubStatsSnapshot'
import { getTrackableLastCommit } from '@/lib/github'
import { REPOS } from '@/lib/scores'
import { getAdminNotes } from '@/lib/admin'
import { getCachedAutoScoresResult } from '@/lib/autoscore'
import { makeUnscoredRecentRepo } from '@/lib/recentRepos'
import { getAllCollectionSlugs, getTrackableForceIncludeSet } from '@/lib/repoCollections'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { getExcludedSlugs, applyExcludedToRepos, filterPublicRepos } from '@/lib/repoExclude'
import {
  mergeRepoSources,
  buildReposInGithubOrder,
  githubSlugOrder,
  cacheLookupSlugs,
} from '@/lib/repoOrder'
import { buildPathToC } from '@/lib/gradePathToC'
import {
  calcBuilderGrade,
  calcTokenMechanicGrade,
  calcShippingLeverageGrade,
  calcIntegrityGrade,
  consumerEconomicRepos,
  type IntegrityGrade,
} from '@/lib/grades'
import {
  buildBuilderTrendExplanation,
  buildTokenMechanicTrendExplanation,
  buildIntegrityTrendExplanation,
  buildShippingLeverageTrendExplanation,
} from '@/lib/gradeNarratives'
import { type RepoWithLive } from '@/components/RepoList'
import HomeRepoSection from '@/components/HomeRepoSection'
import GradesPanel from '@/components/GradesPanel'
import AllTimeStats from '@/components/AllTimeStats'
import HomeHeader from '@/components/HomeHeader'
import BuildBriefCard from '@/components/BuildBriefCard'
import NeedleCard from '@/components/NeedleCard'
import { getNeedle } from '@/lib/needle'
import OverheardCard from '@/components/OverheardCard'
import { getFeaturedOverheardEntry, getOverheardDigest } from '@/lib/overheard'
import SpottedCard from '@/components/SpottedCard'
import { getLatestPublished } from '@/lib/spotted'
import { GradePeriodProvider } from '@/components/GradePeriodContext'
import { getRescoreBurnStats } from '@/lib/rescoreBurns'
import { getRescoreSummaries } from '@/lib/rescoreSummaries'
import { getBuildBrief } from '@/lib/buildBrief'
import { isCommunityContextEnabled, getContextSummaryBySlug, buildCommunityPulse } from '@/lib/communityContext'
import { calcEcosystemPulse } from '@/lib/ecosystemPulse'
import type { GitHubStats } from '@/lib/github'

export const dynamic = 'force-dynamic'

function degradedBannerMessage(opts: {
  githubUnavailable: boolean
  cacheUnavailable: boolean
  rateLimited: boolean
}): string {
  const parts: string[] = []
  if (opts.githubUnavailable) parts.push('GitHub data unavailable — commit counts and activity grades may be limited.')
  if (opts.cacheUnavailable) parts.push('Live score cache temporarily unavailable — showing baseline repos where needed.')
  if (opts.rateLimited) {
    parts.push('GitHub rate limit reached — commit data is partial. Add a GITHUB_TOKEN env var for full data.')
  }
  return parts.join(' ')
}

export default async function Home() {
  let stats: GitHubStats | null = null
  let githubUnavailable = false
  let cacheUnavailable = false
  const communityContextEnabled = isCommunityContextEnabled()
  const contextSummary = communityContextEnabled ? await getContextSummaryBySlug().catch(() => ({})) : {}
  const communityPulse = communityContextEnabled ? buildCommunityPulse(contextSummary) : null

 const [rescoreBurns, buildBrief, needle, overheardEntry, overheardDigest, spotted] = await Promise.all([
  getRescoreBurnStats().catch(() => null),
  getBuildBrief().catch(() => null),
  getNeedle().catch(() => null),
  getFeaturedOverheardEntry().catch(() => null),
  getOverheardDigest().catch(() => null),
  getLatestPublished().catch(() => null),
])

  const { stats: loadedStats, source: loadedSource } = await loadGitHubStatsForPage().catch(err => {
    console.error('[home] GitHub stats load failed', err)
    return { stats: null as GitHubStats | null, source: 'none' as const }
  })
  stats = loadedStats
  if (loadedSource === 'none') githubUnavailable = true
  const trackableLastCommit = stats ? getTrackableLastCommit(stats) : { lastCommitAt: null, lastCommitRepo: null }

  const snapshotUpdatedAt = await getGitHubStatsSnapshotUpdatedAt().catch(() => null)
  const dataAsOfLabel = snapshotUpdatedAt ? timeAgo(snapshotUpdatedAt) : null
  const dataStale = snapshotUpdatedAt
    ? Date.now() - new Date(snapshotUpdatedAt).getTime() > 26 * 60 * 60 * 1000
    : false

  const [adminNotes, excludedMap, collectionSlugs, forceIncludeSet] = await Promise.all([
    getAdminNotes(),
    getExcludedSlugs(),
    getAllCollectionSlugs().catch(() => ({ 'cv-related': [] as string[], 'clawd-gated': [] as string[] })),
    getTrackableForceIncludeSet().catch(() => new Set<string>()),
  ])

  const excludedSlugs = new Set(Object.keys(excludedMap).filter(k => excludedMap[k]))

  const trackableGithub = stats?.trackableRepos ?? []
  const cacheSlugs = cacheLookupSlugs(REPOS, trackableGithub, excludedSlugs)
  let autoScoredRaw: Awaited<ReturnType<typeof getCachedAutoScoresResult>>['repos'] = []
  if (cacheSlugs.length > 0) {
    const cached = await getCachedAutoScoresResult(cacheSlugs)
    autoScoredRaw = cached.repos
    if (cached.cacheReadFailed) cacheUnavailable = true
  }
  const autoScored = autoScoredRaw.filter(r => !shouldSkipRepo(r.githubSlug, { forceInclude: forceIncludeSet }))

  const allRepos = filterPublicRepos(applyExcludedToRepos(mergeRepoSources(REPOS, autoScored), excludedMap))

  const reposBase = stats
    ? buildReposInGithubOrder(trackableGithub, REPOS, autoScored, makeUnscoredRecentRepo)
    : allRepos

  const reposWithLive: RepoWithLive[] = reposBase.map(r => {
    const activity = stats?.repoActivity[r.githubSlug]
    const githubRepo = trackableGithub.find(gr => gr.name === r.githubSlug)
      ?? stats?.repos.find(gr => gr.name === r.githubSlug)
    const scanned = activity ? inferCommitsScanned(activity) : false
    return {
      ...r,
      adminNote: adminNotes[r.id] ?? r.adminNote ?? null,
      description: githubRepo?.description?.trim() || null,
      createdAt: githubRepo?.createdAt ?? null,
      lastCommitAt: activity?.lastCommitAt ?? null,
      pushedAt: githubRepo?.pushedAt ?? activity?.pushedAt ?? null,
      commitsScanned: activity ? scanned : null,
      commits24h: activity && scanned ? (activity.commits24h ?? 0) : null,
      commits30d: activity && scanned ? (activity.commits30d ?? 0) : null,
      commits7d: activity && scanned ? (activity.commits7d ?? 0) : null,
      commits7_14: activity && scanned ? (activity.commits7_14 ?? 0) : null,
      commits30_60: activity && scanned ? (activity.commits30_60 ?? 0) : null,
      commitTimestamps: activity?.commitTimestamps ?? null,
      commitsCapped: activity?.commitsCapped ?? null,
    }
  })

  const repos: RepoWithLive[] = filterPublicRepos(
    applyExcludedToRepos(reposWithLive, excludedMap),
  )

  const rescoreSummaries = await getRescoreSummaries(repos.map(r => r.githubSlug)).catch(() => ({}))

  const githubOrder = stats ? githubSlugOrder(trackableGithub) : []

  const holderEconRepos = consumerEconomicRepos(allRepos)

  function withPathToC(grade: IntegrityGrade | null): IntegrityGrade | null {
    if (!grade) return grade
    const pathToC = buildPathToC(grade)
    return pathToC ? { ...grade, pathToC } : grade
  }

  const builderGrade24Raw = stats ? calcBuilderGrade(stats, '24h') : null
  const builderGrade30Raw = stats ? calcBuilderGrade(stats, '30d') : null
  const builderGrade7Raw = stats ? calcBuilderGrade(stats, '7d') : null
  const tokenMechanicGrade24Raw = stats ? calcTokenMechanicGrade(stats, '24h', allRepos) : null
  const tokenMechanicGrade30Raw = stats ? calcTokenMechanicGrade(stats, '30d', allRepos) : null
  const tokenMechanicGrade7Raw = stats ? calcTokenMechanicGrade(stats, '7d', allRepos) : null
  const integrityGrade24Raw = withPathToC(
    stats ? calcIntegrityGrade(stats, '24h', allRepos) : calcIntegrityGrade(null, '24h', allRepos),
  )
  const integrityGrade30Raw = withPathToC(
    stats ? calcIntegrityGrade(stats, '30d', allRepos) : calcIntegrityGrade(null, '30d', allRepos),
  )
  const integrityGrade7Raw = withPathToC(
    stats ? calcIntegrityGrade(stats, '7d', allRepos) : calcIntegrityGrade(null, '7d', allRepos),
  )

  const shippingLeverageGrade24Raw = stats ? calcShippingLeverageGrade(stats, '24h', allRepos) : null
  const shippingLeverageGrade30Raw = stats ? calcShippingLeverageGrade(stats, '30d', allRepos) : null
  const shippingLeverageGrade7Raw = stats ? calcShippingLeverageGrade(stats, '7d', allRepos) : null
  const shippingLeverageGrade60 = stats ? calcShippingLeverageGrade(stats, '60d', allRepos) : null

  const builderGrade60Raw = stats ? calcBuilderGrade(stats, '60d') : null
  const tokenMechanicGrade60Raw = stats ? calcTokenMechanicGrade(stats, '60d', allRepos) : null
  const integrityGrade60Raw = withPathToC(
    stats ? calcIntegrityGrade(stats, '60d', allRepos) : calcIntegrityGrade(null, '60d', allRepos),
  )

  const builderGrade24 = builderGrade24Raw && stats
    ? { ...builderGrade24Raw, trendExplanation: buildBuilderTrendExplanation(stats, '24h', builderGrade24Raw.pct, builderGrade24Raw.priorPct, builderGrade24Raw.trend, allRepos) }
    : builderGrade24Raw
  const builderGrade30 = builderGrade30Raw && stats
    ? { ...builderGrade30Raw, trendExplanation: buildBuilderTrendExplanation(stats, '30d', builderGrade30Raw.pct, builderGrade30Raw.priorPct, builderGrade30Raw.trend, allRepos) }
    : builderGrade30Raw
  const builderGrade7 = builderGrade7Raw && stats
    ? { ...builderGrade7Raw, trendExplanation: buildBuilderTrendExplanation(stats, '7d', builderGrade7Raw.pct, builderGrade7Raw.priorPct, builderGrade7Raw.trend, allRepos) }
    : builderGrade7Raw
  const tokenMechanicGrade24 = tokenMechanicGrade24Raw && stats
    ? {
        ...tokenMechanicGrade24Raw,
        trendExplanation: buildTokenMechanicTrendExplanation(
          stats,
          '24h',
          holderEconRepos,
          tokenMechanicGrade24Raw.pct,
          tokenMechanicGrade24Raw.priorPct,
          tokenMechanicGrade24Raw.trend,
          allRepos,
        ),
      }
    : tokenMechanicGrade24Raw
  const tokenMechanicGrade30 = tokenMechanicGrade30Raw && stats
    ? {
        ...tokenMechanicGrade30Raw,
        trendExplanation: buildTokenMechanicTrendExplanation(
          stats,
          '30d',
          holderEconRepos,
          tokenMechanicGrade30Raw.pct,
          tokenMechanicGrade30Raw.priorPct,
          tokenMechanicGrade30Raw.trend,
          allRepos,
        ),
      }
    : tokenMechanicGrade30Raw
  const tokenMechanicGrade7 = tokenMechanicGrade7Raw && stats
    ? {
        ...tokenMechanicGrade7Raw,
        trendExplanation: buildTokenMechanicTrendExplanation(
          stats,
          '7d',
          holderEconRepos,
          tokenMechanicGrade7Raw.pct,
          tokenMechanicGrade7Raw.priorPct,
          tokenMechanicGrade7Raw.trend,
          allRepos,
        ),
      }
    : tokenMechanicGrade7Raw
  const integrityGrade24 = integrityGrade24Raw && stats
    ? {
        ...integrityGrade24Raw,
        trendExplanation: buildIntegrityTrendExplanation(
          stats,
          '24h',
          allRepos,
          integrityGrade24Raw.pct,
          integrityGrade24Raw.priorPct,
          integrityGrade24Raw.trend,
        ),
      }
    : integrityGrade24Raw
  const integrityGrade30 = integrityGrade30Raw && stats
    ? {
        ...integrityGrade30Raw,
        trendExplanation: buildIntegrityTrendExplanation(
          stats,
          '30d',
          allRepos,
          integrityGrade30Raw.pct,
          integrityGrade30Raw.priorPct,
          integrityGrade30Raw.trend,
        ),
      }
    : integrityGrade30Raw
  const integrityGrade7 = integrityGrade7Raw && stats
    ? {
        ...integrityGrade7Raw,
        trendExplanation: buildIntegrityTrendExplanation(
          stats,
          '7d',
          allRepos,
          integrityGrade7Raw.pct,
          integrityGrade7Raw.priorPct,
          integrityGrade7Raw.trend,
        ),
      }
    : integrityGrade7Raw
  const shippingLeverageGrade24 = shippingLeverageGrade24Raw && stats
    ? {
        ...shippingLeverageGrade24Raw,
        trendExplanation: buildShippingLeverageTrendExplanation(
          stats,
          '24h',
          allRepos,
          shippingLeverageGrade24Raw.pct,
          shippingLeverageGrade24Raw.priorPct,
          shippingLeverageGrade24Raw.trend,
        ),
      }
    : shippingLeverageGrade24Raw
  const shippingLeverageGrade30 = shippingLeverageGrade30Raw && stats
    ? {
        ...shippingLeverageGrade30Raw,
        trendExplanation: buildShippingLeverageTrendExplanation(
          stats,
          '30d',
          allRepos,
          shippingLeverageGrade30Raw.pct,
          shippingLeverageGrade30Raw.priorPct,
          shippingLeverageGrade30Raw.trend,
        ),
      }
    : shippingLeverageGrade30Raw
  const shippingLeverageGrade7 = shippingLeverageGrade7Raw && stats
    ? {
        ...shippingLeverageGrade7Raw,
        trendExplanation: buildShippingLeverageTrendExplanation(
          stats,
          '7d',
          allRepos,
          shippingLeverageGrade7Raw.pct,
          shippingLeverageGrade7Raw.priorPct,
          shippingLeverageGrade7Raw.trend,
        ),
      }
    : shippingLeverageGrade7Raw
  const builderGrade60 = builderGrade60Raw
  const tokenMechanicGrade60 = tokenMechanicGrade60Raw
  const integrityGrade60 = integrityGrade60Raw

  const pulse24 = stats ? calcEcosystemPulse(allRepos, stats, '24h') : null
  const pulse30 = stats ? calcEcosystemPulse(allRepos, stats, '30d') : null
  const pulse7 = stats ? calcEcosystemPulse(allRepos, stats, '7d') : null
  const pulse60 = stats ? calcEcosystemPulse(allRepos, stats, '60d') : null

  return (
    <GradePeriodProvider>
    <>
      <div style={{ marginBottom: '24px' }}>
        <HomeHeader
          rescoreBurns={rescoreBurns}
          latestCommitLabel={trackableLastCommit.lastCommitAt ? `Latest commit ${timeAgo(trackableLastCommit.lastCommitAt)}` : null}
          dataAsOfLabel={dataAsOfLabel}
          dataStale={dataStale}
        />
      </div>

      {(githubUnavailable || cacheUnavailable || stats?.rateLimited) && (
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '24px',
          }}
        >
          {degradedBannerMessage({
            githubUnavailable,
            cacheUnavailable,
            rateLimited: Boolean(stats?.rateLimited),
          })}{' '}
          {(githubUnavailable || stats?.rateLimited) && (
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
              Create a free token →
            </a>
          )}
        </div>
      )}

      <BuildBriefCard brief={buildBrief} />
      <NeedleCard needle={needle} />
      {(spotted || overheardEntry) && (
        <div className="mentions-row">
          {spotted && <SpottedCard spotted={spotted} />}
          {overheardEntry && <OverheardCard entry={overheardEntry} digest={overheardDigest} />}
        </div>
      )}

      <div style={{ marginBottom: '32px' }}>
      <GradesPanel
        builderGrade24={builderGrade24}
        builderGrade30={builderGrade30}
        builderGrade7={builderGrade7}
        builderGrade60={builderGrade60}
        tokenMechanicGrade24={tokenMechanicGrade24}
        tokenMechanicGrade30={tokenMechanicGrade30}
        tokenMechanicGrade7={tokenMechanicGrade7}
        tokenMechanicGrade60={tokenMechanicGrade60}
        shippingLeverageGrade24={shippingLeverageGrade24}
        shippingLeverageGrade30={shippingLeverageGrade30}
        shippingLeverageGrade7={shippingLeverageGrade7}
        shippingLeverageGrade60={shippingLeverageGrade60}
        integrityGrade24={integrityGrade24}
        integrityGrade30={integrityGrade30}
        integrityGrade7={integrityGrade7}
        integrityGrade60={integrityGrade60}
        stats24h={
          stats
            ? {
                commits: stats.totalCommits24h ?? 0,
                activeDays: stats.activeDays24h ?? 0,
                newRepos: stats.newRepos24h ?? 0,
              }
            : null
        }
        stats30d={
          stats
            ? {
                commits: stats.totalCommits30d,
                activeDays: stats.activeDays30d,
                newRepos: stats.newRepos30d,
              }
            : null
        }
        stats7d={
          stats
            ? {
                commits: stats.totalCommits7d,
                activeDays: stats.activeDays7d,
                newRepos: stats.newRepos7d,
              }
            : null
        }
        stats60d={
          stats
            ? {
                commits: stats.totalCommits30d + stats.totalCommits30_60,
                activeDays: stats.activeDays30d + stats.activeDays30_60,
                newRepos: stats.newRepos30d + stats.newRepos30_60,
              }
            : null
        }
        digestCards={buildBrief?.cards ?? null}
        githubStats={stats}
        repos={repos}
        communityContextEnabled={communityContextEnabled}
      />
      </div>

      {stats && (
      <div style={{ marginBottom: '32px' }}>
        <AllTimeStats
          totalRepos={stats.totalRepos}
          pulse24={pulse24!}
          pulse30={pulse30!}
          pulse7={pulse7!}
          pulse60={pulse60!}
          totalCommits24h={stats.totalCommits24h ?? 0}
          totalCommits24_48={stats.totalCommits24_48 ?? 0}
          totalCommits30d={stats.totalCommits30d}
          totalCommits7d={stats.totalCommits7d}
          totalCommits30_60={stats.totalCommits30_60}
          totalCommits7_14={stats.totalCommits7_14}
          activeDays24h={stats.activeDays24h ?? 0}
          activeDays24_48={stats.activeDays24_48 ?? 0}
          activeDays30d={stats.activeDays30d}
          activeDays7d={stats.activeDays7d}
          activeDays30_60={stats.activeDays30_60}
          activeDays7_14={stats.activeDays7_14}
          lastCommitAt={trackableLastCommit.lastCommitAt}
          lastCommitRepo={trackableLastCommit.lastCommitRepo}
        />
      </div>
      )}

      <div style={{ marginTop: '40px' }}>
      <HomeRepoSection
        repos={repos}
        githubSlugOrder={githubOrder}
        initialRescoreSummaries={rescoreSummaries}
        repoCollections={collectionSlugs}
        communityContextEnabled={communityContextEnabled}
        contextSummary={contextSummary}
        communityPulse={communityPulse}
      />
      </div>
    </>
    </GradePeriodProvider>
  )
}
