import { getGitHubStats, timeAgo } from '@/lib/github'
import { getChronicleBannerData } from '@/lib/chronicle'
import { REPOS, CHANGELOG } from '@/lib/scores'
import { getAdminNotes } from '@/lib/admin'
import { getCachedAutoScoresForSlugs } from '@/lib/autoscore'
import { makeUnscoredRecentRepo } from '@/lib/recentRepos'
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
import RepoList, { type RepoWithLive } from '@/components/RepoList'
import GradesPanel from '@/components/GradesPanel'
import AllTimeStats from '@/components/AllTimeStats'
import HomeHeader from '@/components/HomeHeader'
import { GradePeriodProvider } from '@/components/GradePeriodContext'
import { getRescoreBurnStats } from '@/lib/rescoreBurns'
import { getRescoreSummaries } from '@/lib/rescoreSummaries'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let stats
  let error = false
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

  const trackableGithub = stats?.trackableRepos ?? []
  const cacheSlugs = cacheLookupSlugs(REPOS, trackableGithub, excludedSlugs)
  const autoScoredRaw = cacheSlugs.length > 0 ? await getCachedAutoScoresForSlugs(cacheSlugs) : []
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
      commits7_14: activity?.commits7_14 ?? null,
      commits30_60: activity?.commits30_60 ?? null,
    }
  })

  const repos: RepoWithLive[] = filterPublicRepos(
    applyExcludedToRepos(reposWithLive, excludedMap),
  )

  const rescoreSummaries = await getRescoreSummaries(repos.map(r => r.githubSlug)).catch(() => ({}))

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

  const pulse30 = stats ? calcEcosystemPulse(allRepos, stats, '30d') : null
  const pulse7 = stats ? calcEcosystemPulse(allRepos, stats, '7d') : null
  const pulse60 = stats ? calcEcosystemPulse(allRepos, stats, '60d') : null

  return (
    <GradePeriodProvider>
    <>
      <div style={{ marginBottom: '24px' }}>
        <HomeHeader
          rescoreBurns={rescoreBurns}
          latestCommitLabel={stats?.lastCommitAt ? `Latest commit ${timeAgo(stats.lastCommitAt)}` : null}
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

      <div style={{ marginBottom: '32px' }}>
      <GradesPanel
        pulse30={pulse30}
        pulse7={pulse7}
        pulse60={pulse60}
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
          lastCommitAt={stats.lastCommitAt}
          lastCommitRepo={stats.lastCommitRepo}
        />
      </div>
      )}

      <div style={{ marginTop: '40px' }}>
      {(chronicle?.lastUpdated || chronicle?.summary) && (
        <div
          id="chronicle"
          style={{
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '24px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              <a
                href="https://github.com/clawdbotatg/clawd-chronicle"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                Latest Chronicle
              </a>
              {chronicle?.lastUpdated && (
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '8px' }}>
                  · {chronicle.lastUpdated.label}
                </span>
              )}
            </span>
            <span
              className="rubric-source-clamp"
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {chronicle?.summary ?? chronicle?.lastUpdated?.message ?? 'Scoring context sourced from the clawdbotatg Chronicle.'}
            </span>
          </div>
          <a
            href="/context"
            style={{
              fontSize: '12px',
              color: 'var(--accent)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            Scoring context →
          </a>
        </div>
      )}

      <RepoList repos={repos} githubSlugOrder={githubOrder} initialRescoreSummaries={rescoreSummaries} />
      </div>

      <div id="how-we-score" style={{ marginTop: '48px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-primary)' }}>
          How we score
        </h2>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '20px' }}>
          All three axes measure holder value from different angles. Builder activity tells you if the project is alive and shipping. Token mechanic (consumer apps) or shipping leverage (infra/indirect repos) tells you if value flows back to holders — directly through burns and locks, or indirectly by multiplying how fast consumer apps ship. Builder integrity tells you if the builder can be trusted to keep delivering on their stated vision. Together they answer: is this worth holding?
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
          Three ways a grade gets on a card:{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>launch baseline</strong>{' '}
          (fixed Jun 15 snapshot),{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>live AI</strong>{' '}
          (auto-inferred or paid Rescore). See{' '}
          <a href="/about#score-types" style={{ color: 'var(--accent)' }}>About → Score types</a>{' '}
          and <a href="/context" style={{ color: 'var(--accent)' }}>scoring context</a>.
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
            Ecosystem grades (v3)
          </div>
          <div><strong>Ecosystem pulse</strong> — repos shipping, stable, or done in the selected window. Quiet repos are stable, not failures.</div>
          <div><strong>Burn apps (economic)</strong> — commit-weighted token mechanic for direct and supply-lock repos only. Infra and tools are excluded.</div>
          <div><strong>Builder activity</strong> — GitHub shipping velocity across the ecosystem.</div>
          <div><strong>Builder integrity</strong> — commit-weighted trust and alignment scores.</div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Infra cards show economic N/A (indirect) plus a display-only shipping leverage score. Critical-path repos have locked tags and floor at C when functioning as designed.
            Card badges: <strong>Shipping</strong> (commits in window), <strong>Stable</strong> (quiet — normal for infra, waiting burns, locks), <strong>Done ✅</strong> (completed supply-lock with strong integrity).
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
            Token mechanic grade (period tabs)
          </div>
          <p style={{ margin: 0 }}>
            Token mechanic grade is the commit-weighted average of each repo&apos;s economic score — token mechanic for consumer apps, shipping leverage for infra/indirect/theoretical repos.
            Repos with more commits in the window carry more weight. The tag (direct, supply-lock, indirect…) is a
            displayed classification, not a direct grade input.
          </p>
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
          <div className="letter-grade-scale">
            A+ 97–100 · A 93–96 · A- 90–92 · B+ 87–89 · B 83–86 · B- 80–82 · C+ 77–79 · C 73–76 · C- 70–72 · D+ 67–69 · D 63–66 · D- 60–62 · F+ 50–59 · F 40–49 · F- below 40
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {[
            {
              title: 'Token mechanic — consumer apps (direct, supply-lock)',
              rows: [
                { label: 'Direct CLAWD economic impact', weight: '50%' },
                { label: 'Mechanism clarity and holder relevance', weight: '30%' },
                { label: 'Alignment with CLAWD economic story', weight: '20%' },
              ],
              note:
                'Measures CLAWD-facing economic impact from repo evidence and Chronicle context. Each row rated low / mid / high; score = (weighted sum ÷ 3) × 100.',
            },
            {
              title: 'Shipping leverage — infra, indirect, theoretical',
              rows: [
                { label: 'Multiplies builder shipping capacity', weight: '40%' },
                { label: 'Downstream path to holder value', weight: '35%' },
                { label: 'Role in ecosystem workflow', weight: '25%' },
              ],
              note:
                'Replaces token mechanic for repos that enable shipping rather than burn CLAWD directly (e.g. clawd-harness, clawd-containers, dead-simple-agent). Low direct burn is expected — score the multiplier effect on the autonomous-builder thesis.',
            },
            {
              title: 'Builder integrity — all repos (5 rows)',
              rows: [
                { label: 'On-chain commitments and constraints', weight: '22%' },
                { label: 'User funds, risk, and safety posture', weight: '20%' },
                { label: 'Transparency and verifiability', weight: '18%' },
                { label: 'Governance, token-economics, and ecosystem alignment', weight: '20%' },
                { label: 'Security, testing, and cryptographic rigor', weight: '20%' },
              ],
              note:
                'Measures builder trustworthiness — enforceable commitments, safety, verifiability, ecosystem alignment, and rigor. Rows scored high (100) / mid (67) / low (33), then weighted sum. CV is not CLAWD; supply lock is not a burn.',
            },
            {
              title: 'Builder activity — GitHub signals (ecosystem-wide)',
              rows: [
                { label: 'Total commits in window', weight: '20%' },
                { label: 'Active days in window', weight: '20%' },
                { label: 'New repos created', weight: '20%' },
                { label: 'Repos with new commits', weight: '20%' },
                { label: 'Commit consistency ratio', weight: '20%' },
              ],
              note:
                'Measures whether clawdbotatg is alive and shipping across ~150–200 repos. Each signal = min(actual ÷ target, 1) × 20%; consistency uses activeDays ÷ windowDays vs ratio targets (0.7 / 0.5 / 0.4 for 7d / 30d / 60d). Not the same as token mechanic or per-repo integrity.',
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
                  className="rubric-weight-row"
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
              <div key={i} className="changelog-row" style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
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
          and the clawdbotatg Chronicle. Scores are interpretive — launch baseline grades are a fixed snapshot; live AI scores update via Rescore. If you think a score is wrong, that conversation should happen in the open.
        </div>
      </div>
    </>
    </GradePeriodProvider>
  )
}
