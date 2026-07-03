import { getGitHubStats, timeAgo } from '@/lib/github'
import { getChronicleBannerData } from '@/lib/chronicle'
import { getLastGithubScanAt, formatScanAt } from '@/lib/githubScan'
import { REPOS, CHANGELOG } from '@/lib/scores'
import { getAdminNotes } from '@/lib/admin'
import { getAutoScores } from '@/lib/autoscore'
import { makeUnscoredRecentRepo } from '@/lib/recentRepos'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { getExcludedSlugs, applyExcludedToRepos, filterPublicRepos } from '@/lib/repoExclude'
import { mergeRepoSources, buildReposInGithubOrder, githubSlugOrder } from '@/lib/repoOrder'
import { calcBuilderGrade, calcTokenMechanicGrade, calcIntegrityGrade } from '@/lib/grades'
import {
  buildBuilderTrendExplanation,
  buildTokenMechanicTrendExplanation,
  buildIntegrityTrendExplanation,
} from '@/lib/gradeNarratives'
import { calcOverallGradeWithTrend, calcOverallGrade, countReposScored, buildOverallGradeContext } from '@/lib/overallGrade'
import { getOverallSummary } from '@/lib/overallSummary'
import RepoList, { type RepoWithLive } from '@/components/RepoList'
import GradesPanel from '@/components/GradesPanel'
import AllTimeStats from '@/components/AllTimeStats'
import RescoreBurnTracker from '@/components/RescoreBurnTracker'
import { GradePeriodProvider } from '@/components/GradePeriodContext'
import { getRescoreBurnStats } from '@/lib/rescoreBurns'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let stats
  let error = false
  const lastGithubScanAt = await getLastGithubScanAt()
  const chronicle = await getChronicleBannerData().catch(() => null)
  const rescoreBurns = await getRescoreBurnStats().catch(() => null)

  try {
    stats = await getGitHubStats()
  } catch {
    error = true
    stats = null
  }

  const adminNotes = await getAdminNotes()
  const excludedMap = await getExcludedSlugs()
  const excludedSlugs = new Set(Object.keys(excludedMap).filter(k => excludedMap[k]))

  const existingSlugs = new Set(REPOS.map(r => r.githubSlug))
  const trackableGithub = stats?.trackableRepos ?? []
  const unscoredRepos = trackableGithub.filter(
    repo => !existingSlugs.has(repo.name) && !excludedSlugs.has(repo.name),
  )
  const autoScoredRaw = unscoredRepos.length > 0 ? await getAutoScores(unscoredRepos) : []
  const autoScored = autoScoredRaw.filter(r => !shouldSkipRepo(r.githubSlug))

  const allRepos = filterPublicRepos(applyExcludedToRepos(mergeRepoSources(REPOS, autoScored), excludedMap))

  const reposBase = stats
    ? buildReposInGithubOrder(trackableGithub, REPOS, autoScored, makeUnscoredRecentRepo)
    : allRepos

  const reposWithLive: RepoWithLive[] = reposBase.map(r => {
    const activity = stats?.repoActivity[r.githubSlug]
    const githubRepo = trackableGithub.find(gr => gr.name === r.githubSlug)
      ?? stats?.repos.find(gr => gr.name === r.githubSlug)
    return {
      ...r,
      adminNote: adminNotes[r.id] ?? r.adminNote ?? null,
      description: githubRepo?.description?.trim() || null,
      lastCommitAt: activity?.lastCommitAt ?? null,
      pushedAt: githubRepo?.pushedAt ?? activity?.pushedAt ?? null,
      commits30d: activity?.commits30d ?? null,
      commits7d: activity?.commits7d ?? null,
      commits30_60: activity?.commits30_60 ?? null,
    }
  })

  const repos: RepoWithLive[] = filterPublicRepos(
    applyExcludedToRepos(reposWithLive, excludedMap),
  )

  const githubOrder = stats ? githubSlugOrder(trackableGithub) : []

  const builderGrade30Raw = stats ? calcBuilderGrade(stats, '30d') : null
  const builderGrade7Raw = stats ? calcBuilderGrade(stats, '7d') : null
  const tokenMechanicGrade30Raw = stats ? calcTokenMechanicGrade(stats, '30d', allRepos) : null
  const tokenMechanicGrade7Raw = stats ? calcTokenMechanicGrade(stats, '7d', allRepos) : null
  const integrityGrade30Raw = stats ? calcIntegrityGrade(stats, '30d', allRepos) : calcIntegrityGrade(null, '30d', allRepos)
  const integrityGrade7Raw = stats ? calcIntegrityGrade(stats, '7d', allRepos) : calcIntegrityGrade(null, '7d', allRepos)

  const builderGrade60Raw = stats ? calcBuilderGrade(stats, '60d') : null
  const tokenMechanicGrade60Raw = stats ? calcTokenMechanicGrade(stats, '60d', allRepos) : null
  const integrityGrade60Raw = stats ? calcIntegrityGrade(stats, '60d', allRepos) : calcIntegrityGrade(null, '60d', allRepos)

  const builderGrade30 = builderGrade30Raw && stats
    ? { ...builderGrade30Raw, trendExplanation: buildBuilderTrendExplanation(stats, '30d', builderGrade30Raw.trendPct, builderGrade30Raw.trend) }
    : builderGrade30Raw
  const builderGrade7 = builderGrade7Raw && stats
    ? { ...builderGrade7Raw, trendExplanation: buildBuilderTrendExplanation(stats, '7d', builderGrade7Raw.trendPct, builderGrade7Raw.trend) }
    : builderGrade7Raw
  const tokenMechanicGrade30 = tokenMechanicGrade30Raw && stats
    ? { ...tokenMechanicGrade30Raw, trendExplanation: buildTokenMechanicTrendExplanation(stats, '30d', allRepos, tokenMechanicGrade30Raw.trendPct, tokenMechanicGrade30Raw.trend) }
    : tokenMechanicGrade30Raw
  const tokenMechanicGrade7 = tokenMechanicGrade7Raw && stats
    ? { ...tokenMechanicGrade7Raw, trendExplanation: buildTokenMechanicTrendExplanation(stats, '7d', allRepos, tokenMechanicGrade7Raw.trendPct, tokenMechanicGrade7Raw.trend) }
    : tokenMechanicGrade7Raw
  const integrityGrade30 = integrityGrade30Raw && stats
    ? { ...integrityGrade30Raw, trendExplanation: buildIntegrityTrendExplanation(stats, '30d', allRepos, integrityGrade30Raw.trendPct, integrityGrade30Raw.trend) }
    : integrityGrade30Raw
  const integrityGrade7 = integrityGrade7Raw && stats
    ? { ...integrityGrade7Raw, trendExplanation: buildIntegrityTrendExplanation(stats, '7d', allRepos, integrityGrade7Raw.trendPct, integrityGrade7Raw.trend) }
    : integrityGrade7Raw
  const builderGrade60 = builderGrade60Raw
  const tokenMechanicGrade60 = tokenMechanicGrade60Raw
  const integrityGrade60 = integrityGrade60Raw

  const reposScored = countReposScored(allRepos)
  const overallGrade30 = calcOverallGradeWithTrend(
    tokenMechanicGrade30,
    builderGrade30,
    integrityGrade30!,
    reposScored,
  )
  const overallGrade7 = calcOverallGradeWithTrend(
    tokenMechanicGrade7,
    builderGrade7,
    integrityGrade7!,
    reposScored,
  )
  const overallGrade60Base = calcOverallGrade(
    tokenMechanicGrade60,
    builderGrade60,
    integrityGrade60!,
    reposScored,
  )
  const overallGrade60 = overallGrade60Base
    ? { ...overallGrade60Base, trendPct: null, trend: 'flat' as const }
    : null
  const [overallSummary30, overallSummary7, overallSummary60] = await Promise.all([
    overallGrade30
      ? getOverallSummary(
          buildOverallGradeContext(
            overallGrade30,
            tokenMechanicGrade30,
            builderGrade30,
            integrityGrade30!,
            allRepos,
            stats,
            '30d',
          ),
        ).catch(() => null)
      : Promise.resolve(null),
    overallGrade7
      ? getOverallSummary(
          buildOverallGradeContext(
            overallGrade7,
            tokenMechanicGrade7,
            builderGrade7,
            integrityGrade7!,
            allRepos,
            stats,
            '7d',
          ),
        ).catch(() => null)
      : Promise.resolve(null),
    overallGrade60
      ? getOverallSummary(
          buildOverallGradeContext(
            overallGrade60,
            tokenMechanicGrade60,
            builderGrade60,
            integrityGrade60!,
            allRepos,
            stats,
            '60d',
          ),
        ).catch(() => null)
      : Promise.resolve(null),
  ])

  return (
    <GradePeriodProvider>
    <>
      <div style={{ marginBottom: '40px', paddingBottom: '24px', borderBottom: '1px solid var(--border-strong)' }}>
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '6px',
          }}
        >
          The Build Report
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          A plain English look at the repos, scored and sourced.
        </p>
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '8px 14px',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <span style={{ flex: '1 1 200px' }}>
              Scores are interpretive — based on the{' '}
              <a href="https://github.com/clawdbotatg" target="_blank" rel="noopener noreferrer">
                Chronicle
              </a>{' '}
              and public GitHub data. Not financial advice. <a href="/about">Full disclaimer →</a>
            </span>
            {rescoreBurns && rescoreBurns.clawdTotal > 0 && (
              <RescoreBurnTracker clawdTotal={rescoreBurns.clawdTotal} />
            )}
          </div>
          <span>
            GitHub data updates when a scan is run from the admin panel.
            {lastGithubScanAt && ` Last scan: ${formatScanAt(lastGithubScanAt)}.`}
            {stats?.lastCommitAt && ` Latest commit ${timeAgo(stats.lastCommitAt)}.`}
          </span>
        </div>
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

      <div style={{ marginBottom: '40px' }}>
      <GradesPanel
        overall30={overallGrade30}
        overall7={overallGrade7}
        overall60={overallGrade60}
        overallSummary30={overallSummary30}
        overallSummary7={overallSummary7}
        overallSummary60={overallSummary60}
        builderGrade30={builderGrade30}
        builderGrade7={builderGrade7}
        builderGrade60={builderGrade60}
        tokenMechanicGrade30={tokenMechanicGrade30}
        tokenMechanicGrade7={tokenMechanicGrade7}
        tokenMechanicGrade60={tokenMechanicGrade60}
        integrityGrade30={integrityGrade30}
        integrityGrade7={integrityGrade7}
        integrityGrade60={integrityGrade60}
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
      />
      </div>

      {stats && (
      <div style={{ marginBottom: '40px' }}>
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
          lastCommitAt={stats.lastCommitAt}
          lastCommitRepo={stats.lastCommitRepo}
        />
      </div>
      )}

      <div style={{ marginBottom: '40px' }}>
      <RepoList repos={repos} githubSlugOrder={githubOrder} />
      </div>

      {(chronicle?.lastUpdated || chronicle?.summary) && (
        <div style={{ marginTop: '48px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
            <a href="https://github.com/clawdbotatg/clawd-chronicle" target="_blank" rel="noopener noreferrer">
              Chronicle
            </a>
          </h2>
          {chronicle?.lastUpdated && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: chronicle.summary ? '10px' : 0, lineHeight: 1.6 }}>
              Last updated {chronicle.lastUpdated.label} — {chronicle.lastUpdated.message}
            </p>
          )}
          {chronicle?.summary && (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              {chronicle.summary}
            </p>
          )}
        </div>
      )}

      <div id="how-we-score" style={{ marginTop: '48px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-primary)' }}>
          How we score
        </h2>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '20px' }}>
          All three axes measure holder value from different angles. Builder activity tells you if the project is alive and shipping. Token mechanic tells you if value flows back to holders economically through burns, staking, or fee distribution. Builder integrity tells you if the builder can be trusted to keep delivering on their stated vision. Together they answer: is this worth holding?
        </p>

        <div
          style={{
            marginBottom: '24px',
            padding: '14px 16px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Overall grade weights
          </div>
          <div>Token mechanic — 40%: economic return path to holders (burns, locks, fee distribution).</div>
          <div>Builder activity — 30%: shipping velocity and consistency on GitHub.</div>
          <div>Builder integrity — 30%: trust and alignment with stated builder vision.</div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            When GitHub data is unavailable, the 30% activity weight redistributes proportionally between token mechanic and builder integrity.
          </div>
        </div>

        <div
          style={{
            marginBottom: '24px',
            padding: '14px 16px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Grade periods
          </div>
          <div style={{ marginBottom: '6px' }}>
            <strong>7d</strong> — weighted by commits in the last 7 days. Best for: very recent momentum.
          </div>
          <div style={{ marginBottom: '6px' }}>
            <strong>30d</strong> — weighted by commits in the last 30 days. Best for: what&apos;s being built right now.
          </div>
          <div>
            <strong>60d</strong> — weighted by commits in the last 60 days. Best for: broader recent picture, less affected by short-term bursts. Repos being actively built carry more influence than dormant ones.
          </div>
        </div>

        <div
          style={{
            marginBottom: '24px',
            padding: '14px 16px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Letter grade scale
          </div>
          <div>
            A+ 97–100 · A 93–96 · A- 90–92 · B+ 87–89 · B 83–86 · B- 80–82 · C+ 77–79 · C 73–76 · C- 70–72 · D+ 67–69 · D 63–66 · D- 60–62 · F+ 50–59 · F 40–49 · F- below 40
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {[
            {
              title: 'Token mechanic — consumer apps (infra may show N/A)',
              rows: [
                { label: 'Burn mechanic exists and is live', weight: '50%' },
                { label: 'Revenue or burn path built in', weight: '30%' },
                { label: 'Mechanic is operational', weight: '20%' },
              ],
              note:
                'Measures whether value flows back to holders economically. Each component rated low (1) / mid (2) / high (3). Score = (weighted sum ÷ 3) × 100. Consumer apps are scored directly; infrastructure may show N/A at the repo level because no token mechanic is expected — value shows up in downstream consumer apps. Operational status is included because a dormant mechanic isn\'t delivering holder value — a burn contract that hasn\'t been triggered in months scores lower than one running daily.',
            },
            {
              title: 'Builder integrity — all repos',
              rows: [
                { label: 'Serves stated vision at time of build', weight: '40%' },
                { label: 'Genuine autonomous build', weight: '35%' },
                { label: 'Passes walkaway test', weight: '25%' },
              ],
              note:
                "Measures whether the builder can be trusted to keep delivering on their stated vision. Repos are scored against clawdbotatg's stated goals at the time they were built. CV burns are not CLAWD burns. Supply lock is not a burn.",
            },
            {
              title: 'Builder activity — GitHub signals, equally weighted',
              rows: [
                { label: 'Commit frequency', weight: '20%' },
                { label: 'Active days in period', weight: '20%' },
                { label: 'New repos created', weight: '20%' },
                { label: 'Repos with new commits', weight: '20%' },
                { label: 'Consistency — no long gaps', weight: '20%' },
              ],
              note:
                'Measures whether the project is alive and shipping. Five signals averaged equally (20% each). Uses the letter grade scale above.',
            },
          ].map(block => (
            <div
              key={block.title}
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '10px' }}>
                {block.title}
              </div>
              {block.rows.map(row => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  <span>{row.label}</span>
                  <span
                    style={{
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                    }}
                  >
                    {row.weight}
                  </span>
                </div>
              ))}
              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--border)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}
              >
                {block.note}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '10px' }}>
            Repo tags
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              { tag: 'direct', label: 'direct — burn mechanic on every interaction', color: '#5cb87a', bg: 'rgba(92,184,122,0.1)' },
              { tag: 'supply-lock', label: 'supply lock — CLAWD removed temporarily', color: '#5b9bd5', bg: 'rgba(91,155,213,0.1)' },
              { tag: 'indirect', label: 'indirect — enables burns upstream', color: '#a07cd5', bg: 'rgba(160,124,213,0.1)' },
              { tag: 'infrastructure', label: 'infrastructure — no token mechanic expected', color: 'var(--text-secondary)', bg: 'var(--surface-3)' },
              { tag: 'theoretical', label: 'theoretical — R&D, no live mechanic yet', color: '#d4943a', bg: 'rgba(212,148,58,0.1)' },
            ].map(t => (
              <span
                key={t.tag}
                style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: '99px',
                  color: t.color,
                  background: t.bg,
                  fontWeight: 500,
                }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '10px' }}>
            Score changelog
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {CHANGELOG.map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                <span
                  style={{
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    minWidth: '80px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                  }}
                >
                  {entry.date}
                </span>
                <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{entry.note}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Primary source:{' '}
          <a href="https://github.com/clawdbotatg" target="_blank" rel="noopener noreferrer">
            github.com/clawdbotatg
          </a>{' '}
          and the clawdbotatg Chronicle. Scores are interpretive and updated manually. If you think a score is wrong, that conversation should happen in the open.
        </div>
      </div>
    </>
    </GradePeriodProvider>
  )
}
