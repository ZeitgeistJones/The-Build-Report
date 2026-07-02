import { getGitHubStats, timeAgo } from '@/lib/github'
import { REPOS, CHANGELOG } from '@/lib/scores'
import { getAdminNotes } from '@/lib/admin'
import { getAutoScores } from '@/lib/autoscore'
import { makeUnscoredRecentRepo } from '@/lib/recentRepos'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { mergeRepoSources, buildReposInGithubOrder, githubSlugOrder } from '@/lib/repoOrder'
import { calcBuilderGrade, calcHolderRelevanceGrade, calcIntegrityGrade } from '@/lib/grades'
import {
  buildBuilderTrendExplanation,
  buildHolderTrendExplanation,
  buildIntegrityTrendExplanation,
} from '@/lib/gradeNarratives'
import RepoList from '@/components/RepoList'
import GradesPanel from '@/components/GradesPanel'
import AllTimeStats from '@/components/AllTimeStats'

export const revalidate = 300

export default async function Home() {
  let stats
  let error = false

  try {
    stats = await getGitHubStats()
  } catch {
    error = true
    stats = null
  }

  const adminNotes = await getAdminNotes()

  const existingSlugs = new Set(REPOS.map(r => r.githubSlug))
  const trackableGithub = stats?.trackableRepos ?? []
  const unscoredRepos = trackableGithub.filter(repo => !existingSlugs.has(repo.name))
  const autoScoredRaw = unscoredRepos.length > 0 ? await getAutoScores(unscoredRepos) : []
  const autoScored = autoScoredRaw.filter(r => !shouldSkipRepo(r.githubSlug))

  const allRepos = mergeRepoSources(REPOS, autoScored)

  const reposBase = stats
    ? buildReposInGithubOrder(trackableGithub, REPOS, autoScored, makeUnscoredRecentRepo)
    : allRepos

  const repos = reposBase.map(r => {
    const activity = stats?.repoActivity[r.githubSlug]
    const githubRepo = trackableGithub.find(gr => gr.name === r.githubSlug)
      ?? stats?.repos.find(gr => gr.name === r.githubSlug)
    return {
      ...r,
      adminNote: adminNotes[r.id] ?? r.adminNote ?? null,
      lastCommitAt: activity?.lastCommitAt ?? null,
      pushedAt: githubRepo?.pushedAt ?? activity?.pushedAt ?? null,
      commits30d: activity?.commits30d ?? null,
    }
  })

  const githubOrder = stats ? githubSlugOrder(trackableGithub) : []

  const builderGrade30Raw = stats ? calcBuilderGrade(stats, '30d') : null
  const builderGrade7Raw = stats ? calcBuilderGrade(stats, '7d') : null
  const holderGrade30Raw = stats ? calcHolderRelevanceGrade(stats, '30d', allRepos) : null
  const holderGrade7Raw = stats ? calcHolderRelevanceGrade(stats, '7d', allRepos) : null
  const integrityGrade30Raw = stats ? calcIntegrityGrade(stats, '30d', allRepos) : calcIntegrityGrade(null, '30d', allRepos)
  const integrityGrade7Raw = stats ? calcIntegrityGrade(stats, '7d', allRepos) : calcIntegrityGrade(null, '7d', allRepos)

  const builderGrade30 = builderGrade30Raw && stats
    ? { ...builderGrade30Raw, trendExplanation: buildBuilderTrendExplanation(stats, '30d', builderGrade30Raw.trendPct, builderGrade30Raw.trend) }
    : builderGrade30Raw
  const builderGrade7 = builderGrade7Raw && stats
    ? { ...builderGrade7Raw, trendExplanation: buildBuilderTrendExplanation(stats, '7d', builderGrade7Raw.trendPct, builderGrade7Raw.trend) }
    : builderGrade7Raw
  const holderGrade30 = holderGrade30Raw && stats
    ? { ...holderGrade30Raw, trendExplanation: buildHolderTrendExplanation(stats, '30d', allRepos, holderGrade30Raw.trendPct, holderGrade30Raw.trend) }
    : holderGrade30Raw
  const holderGrade7 = holderGrade7Raw && stats
    ? { ...holderGrade7Raw, trendExplanation: buildHolderTrendExplanation(stats, '7d', allRepos, holderGrade7Raw.trendPct, holderGrade7Raw.trend) }
    : holderGrade7Raw
  const integrityGrade30 = integrityGrade30Raw && stats
    ? { ...integrityGrade30Raw, trendExplanation: buildIntegrityTrendExplanation(stats, '30d', allRepos, integrityGrade30Raw.trendPct, integrityGrade30Raw.trend) }
    : integrityGrade30Raw
  const integrityGrade7 = integrityGrade7Raw && stats
    ? { ...integrityGrade7Raw, trendExplanation: buildIntegrityTrendExplanation(stats, '7d', allRepos, integrityGrade7Raw.trendPct, integrityGrade7Raw.trend) }
    : integrityGrade7Raw

  return (
    <>
      <div style={{ marginBottom: '32px' }}>
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
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '8px 14px',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}
        >
          <span>
            Scores are interpretive — based on the{' '}
            <a href="https://github.com/clawdbotatg" target="_blank" rel="noopener noreferrer">
              Chronicle
            </a>{' '}
            and public GitHub data. Not financial advice. <a href="/about">Full disclaimer →</a>
          </span>
          {stats?.lastCommitAt && (
            <span style={{ flexShrink: 0, marginLeft: '12px' }}>
              Latest commit {timeAgo(stats.lastCommitAt)} · data refreshes every 5 min
            </span>
          )}
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

      {stats && (
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
      )}

      <GradesPanel
        builderGrade30={builderGrade30}
        builderGrade7={builderGrade7}
        holderGrade30={holderGrade30}
        holderGrade7={holderGrade7}
        integrityGrade30={integrityGrade30}
        integrityGrade7={integrityGrade7}
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
      />

      <RepoList repos={repos} githubSlugOrder={githubOrder} />

      <div id="how-we-score" style={{ marginTop: '48px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-primary)' }}>
          How we score
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {[
            {
              title: 'Holder relevance — consumer apps (infra may show N/A)',
              rows: [
                { label: 'Burn mechanic exists and is live', weight: '50%' },
                { label: 'Revenue or burn path built in', weight: '30%' },
                { label: 'Takes CLAWD out of circulation', weight: '20%' },
              ],
              note:
                'Each component rated low (1) / mid (2) / high (3). Score = (weighted sum ÷ 3) × 100. We score whether the mechanic exists and is live — not how much has actually burned. Consumer apps are scored directly here. Infrastructure and some theoretical repos may show NA at the repo level because no token mechanic is expected; their value shows up in the quality of downstream consumer apps. Trend percentage compares this period\'s grade to the prior matching window.',
            },
            {
              title: 'Builder integrity — all repos',
              rows: [
                { label: 'Serves stated vision at time of build', weight: '40%' },
                { label: 'Genuine autonomous build', weight: '35%' },
                { label: 'Passes walkaway test', weight: '25%' },
              ],
              note:
                "Repos are scored against clawdbotatg's stated goals at the time they were built. Goals change — a repo is judged against what the stated intent was then, not now. CV burns are not CLAWD burns. Supply lock is not a burn. Both matter but they are different things. Trend percentage compares this period's grade to the prior matching window.",
            },
            {
              title: 'Builder grade — GitHub signals, equally weighted',
              rows: [
                { label: 'Commit frequency', weight: '20%' },
                { label: 'Active days in period', weight: '20%' },
                { label: 'New repos created', weight: '20%' },
                { label: 'Repos with new commits', weight: '20%' },
                { label: 'Consistency — no long gaps', weight: '20%' },
              ],
              note:
                'Five signals averaged equally (20% each). Letter grades: A = 80–100 · B = 60–79 · C = 40–59 · D = below 40. Trend percentage compares this period\'s builder grade to the prior matching window (7d vs days 8–14, 30d vs days 31–60).',
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
  )
}
