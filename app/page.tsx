import { timeAgo, inferCommitsScanned } from '@/lib/github'
import { loadGitHubStatsForPage, getGitHubStatsSnapshotUpdatedAt } from '@/lib/githubStatsSnapshot'
import { getTrackableLastCommit } from '@/lib/github'
import { REPOS } from '@/lib/scores'
import { getAdminNotes } from '@/lib/admin'
import { getCachedAutoScoresForSlugs } from '@/lib/autoscore'
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
import { calcBuilderGrade, calcTokenMechanicGrade, calcIntegrityGrade } from '@/lib/grades'
import {
  buildBuilderTrendExplanation,
  buildTokenMechanicTrendExplanation,
  buildIntegrityTrendExplanation,
} from '@/lib/gradeNarratives'
import { calcEcosystemPulse } from '@/lib/ecosystemPulse'
import { type RepoWithLive } from '@/components/RepoList'
import HomeRepoSection from '@/components/HomeRepoSection'
import GradesPanel from '@/components/GradesPanel'
import AllTimeStats from '@/components/AllTimeStats'
import HomeHeader from '@/components/HomeHeader'
import BuildBriefCard from '@/components/BuildBriefCard'
import { GradePeriodProvider } from '@/components/GradePeriodContext'
import { getRescoreBurnStats } from '@/lib/rescoreBurns'
import { getRescoreSummaries } from '@/lib/rescoreSummaries'
import { getBuildBrief } from '@/lib/buildBrief'
import { isCommunityContextEnabled, getContextSummaryBySlug, buildCommunityPulse } from '@/lib/communityContext'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let stats
  let error = false
  const communityContextEnabled = isCommunityContextEnabled()
  const contextSummary = communityContextEnabled ? await getContextSummaryBySlug().catch(() => ({})) : {}
  const communityPulse = communityContextEnabled ? buildCommunityPulse(contextSummary) : null

  const [rescoreBurns, buildBrief] = await Promise.all([
    getRescoreBurnStats().catch(() => null),
    getBuildBrief().catch(() => null),
  ])

  const { stats: loadedStats, source: loadedSource } = await loadGitHubStatsForPage()
  stats = loadedStats
  if (loadedSource === 'none') error = true
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
  const autoScoredRaw = cacheSlugs.length > 0 ? await getCachedAutoScoresForSlugs(cacheSlugs) : []
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

  const builderGrade24Raw = stats ? calcBuilderGrade(stats, '24h') : null
  const builderGrade30Raw = stats ? calcBuilderGrade(stats, '30d') : null
  const builderGrade7Raw = stats ? calcBuilderGrade(stats, '7d') : null
  const tokenMechanicGrade24Raw = stats ? calcTokenMechanicGrade(stats, '24h', allRepos) : null
  const tokenMechanicGrade30Raw = stats ? calcTokenMechanicGrade(stats, '30d', allRepos) : null
  const tokenMechanicGrade7Raw = stats ? calcTokenMechanicGrade(stats, '7d', allRepos) : null
  const integrityGrade24Raw = stats ? calcIntegrityGrade(stats, '24h', allRepos) : calcIntegrityGrade(null, '24h', allRepos)
  const integrityGrade30Raw = stats ? calcIntegrityGrade(stats, '30d', allRepos) : calcIntegrityGrade(null, '30d', allRepos)
  const integrityGrade7Raw = stats ? calcIntegrityGrade(stats, '7d', allRepos) : calcIntegrityGrade(null, '7d', allRepos)

  const builderGrade60Raw = stats ? calcBuilderGrade(stats, '60d') : null
  const tokenMechanicGrade60Raw = stats ? calcTokenMechanicGrade(stats, '60d', allRepos) : null
  const integrityGrade60Raw = stats ? calcIntegrityGrade(stats, '60d', allRepos) : calcIntegrityGrade(null, '60d', allRepos)

  const builderGrade24 = builderGrade24Raw && stats
    ? { ...builderGrade24Raw, trendExplanation: buildBuilderTrendExplanation(stats, '24h', builderGrade24Raw.trendPct, builderGrade24Raw.trend, allRepos) }
    : builderGrade24Raw
  const builderGrade30 = builderGrade30Raw && stats
    ? { ...builderGrade30Raw, trendExplanation: buildBuilderTrendExplanation(stats, '30d', builderGrade30Raw.trendPct, builderGrade30Raw.trend, allRepos) }
    : builderGrade30Raw
  const builderGrade7 = builderGrade7Raw && stats
    ? { ...builderGrade7Raw, trendExplanation: buildBuilderTrendExplanation(stats, '7d', builderGrade7Raw.trendPct, builderGrade7Raw.trend, allRepos) }
    : builderGrade7Raw
  const tokenMechanicGrade24 = tokenMechanicGrade24Raw && stats
    ? { ...tokenMechanicGrade24Raw, trendExplanation: buildTokenMechanicTrendExplanation(stats, '24h', allRepos, tokenMechanicGrade24Raw.trendPct, tokenMechanicGrade24Raw.trend) }
    : tokenMechanicGrade24Raw
  const tokenMechanicGrade30 = tokenMechanicGrade30Raw && stats
    ? { ...tokenMechanicGrade30Raw, trendExplanation: buildTokenMechanicTrendExplanation(stats, '30d', allRepos, tokenMechanicGrade30Raw.trendPct, tokenMechanicGrade30Raw.trend) }
    : tokenMechanicGrade30Raw
  const tokenMechanicGrade7 = tokenMechanicGrade7Raw && stats
    ? { ...tokenMechanicGrade7Raw, trendExplanation: buildTokenMechanicTrendExplanation(stats, '7d', allRepos, tokenMechanicGrade7Raw.trendPct, tokenMechanicGrade7Raw.trend) }
    : tokenMechanicGrade7Raw
  const integrityGrade24 = integrityGrade24Raw && stats
    ? { ...integrityGrade24Raw, trendExplanation: buildIntegrityTrendExplanation(stats, '24h', allRepos, integrityGrade24Raw.trendPct, integrityGrade24Raw.trend) }
    : integrityGrade24Raw
  const integrityGrade30 = integrityGrade30Raw && stats
    ? { ...integrityGrade30Raw, trendExplanation: buildIntegrityTrendExplanation(stats, '30d', allRepos, integrityGrade30Raw.trendPct, integrityGrade30Raw.trend) }
    : integrityGrade30Raw
  const integrityGrade7 = integrityGrade7Raw && stats
    ? { ...integrityGrade7Raw, trendExplanation: buildIntegrityTrendExplanation(stats, '7d', allRepos, integrityGrade7Raw.trendPct, integrityGrade7Raw.trend) }
    : integrityGrade7Raw
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

      {(error || stats?.rateLimited) && (
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
          {error
            ? 'GitHub data unavailable — showing scores only.'
            : 'GitHub rate limit reached — commit data is partial. Add a GITHUB_TOKEN env var for full data.'}{' '}
          <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
            Create a free token →
          </a>
        </div>
      )}

      <BuildBriefCard brief={buildBrief} />

      <div style={{ marginBottom: '32px' }}>
      <GradesPanel
        pulse24={pulse24}
        pulse30={pulse30}
        pulse7={pulse7}
        pulse60={pulse60}
        builderGrade24={builderGrade24}
        builderGrade30={builderGrade30}
        builderGrade7={builderGrade7}
        builderGrade60={builderGrade60}
        tokenMechanicGrade24={tokenMechanicGrade24}
        tokenMechanicGrade30={tokenMechanicGrade30}
        tokenMechanicGrade7={tokenMechanicGrade7}
        tokenMechanicGrade60={tokenMechanicGrade60}
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
          totalCommits30d={stats.totalCommits30d}
          totalCommits7d={stats.totalCommits7d}
          totalCommits30_60={stats.totalCommits30_60}
          totalCommits7_14={stats.totalCommits7_14}
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
