'use client'

import { useState } from 'react'
import { BuilderGrade, TokenMechanicGrade, IntegrityGrade, formatTrendPct, TrendExplanation, Period } from '@/lib/grades'
import { gradeColor } from '@/lib/gradeLetters'
import { PeriodToggle, useGradePeriod } from './GradePeriodContext'
import EcosystemPulsePanel from './EcosystemPulse'
import { EcosystemPulse } from '@/lib/ecosystemPulse'
import { integrityGradeFootnote } from '@/lib/cardFraming'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  pulse30: EcosystemPulse | null
  pulse7: EcosystemPulse | null
  pulse60: EcosystemPulse | null
  builderGrade30: BuilderGrade | null
  builderGrade7: BuilderGrade | null
  builderGrade60: BuilderGrade | null
  tokenMechanicGrade30: TokenMechanicGrade | null
  tokenMechanicGrade7: TokenMechanicGrade | null
  tokenMechanicGrade60: TokenMechanicGrade | null
  integrityGrade30: IntegrityGrade | null
  integrityGrade7: IntegrityGrade | null
  integrityGrade60: IntegrityGrade | null
  stats30d: { commits: number; activeDays: number; newRepos: number } | null
  stats7d: { commits: number; activeDays: number; newRepos: number } | null
  stats60d: { commits: number; activeDays: number; newRepos: number } | null
}

const TREND_UNAVAILABLE_60D = 'Trend requires 120d scan history'

function TrendArrow({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  if (trend === 'up') return <span style={{ color: 'var(--green)', fontSize: '12px' }}>↑</span>
  if (trend === 'down') return <span style={{ color: 'var(--red)', fontSize: '12px' }}>↓</span>
  return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
}

function GradeCard({
  grade,
  label,
  mini,
  summary,
  period,
  footer,
  trendExplanation,
  isMobile,
}: {
  grade: {
    letter: string
    pct: number
    trend: 'up' | 'flat' | 'down'
    trendPct: number | null
  } | null
  label: string
  mini: string
  summary: string
  period: Period
  footer?: React.ReactNode
  trendExplanation?: TrendExplanation
  isMobile: boolean
}) {
  const [showTrend, setShowTrend] = useState(false)

  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        boxShadow: 'var(--card-elevated)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '10px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
            }}
          >
            {label}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              marginBottom: '4px',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
            }}
          >
            <span
              style={{
                fontSize: '36px',
                lineHeight: 1,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: grade ? gradeColor(grade.letter) : 'var(--text-muted)',
              }}
            >
              {grade?.letter ?? '—'}
            </span>

            {grade && (
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}
              >
                {grade.pct}%
              </span>
            )}

            {grade && period !== '60d' && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <TrendArrow trend={grade.trend} />
                {formatTrendPct(grade.trendPct, period)}
              </span>
            )}

            {grade && period === '60d' && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.3,
                  maxWidth: isMobile ? undefined : 140,
                }}
              >
                {TREND_UNAVAILABLE_60D}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
              maxWidth: 220,
            }}
          >
            {mini}
          </div>
        </div>
      </div>

      <p
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: trendExplanation ? '8px' : '12px',
        }}
      >
        {summary}
      </p>

      {trendExplanation && period !== '60d' && (
        <div style={{ marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setShowTrend(v => !v)}
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              background: 'transparent',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ transform: showTrend ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▸</span>
            Why this trend?
          </button>
          {showTrend && (
            <div
              style={{
                marginTop: '8px',
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
              }}
            >
              <p style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>{trendExplanation.headline}</p>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {trendExplanation.bullets.map(b => (
                  <li key={b} style={{ marginBottom: '4px' }}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {footer && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '10px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 12px',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}

export default function GradesPanel({
  pulse30,
  pulse7,
  pulse60,
  builderGrade30,
  builderGrade7,
  builderGrade60,
  tokenMechanicGrade30,
  tokenMechanicGrade7,
  tokenMechanicGrade60,
  integrityGrade30,
  integrityGrade7,
  integrityGrade60,
  stats30d,
  stats7d,
  stats60d,
}: Props) {
  const { period } = useGradePeriod()
  const isMobile = useIsMobile()
  const footerSize = isMobile ? '11px' : '10px'

  const bg = period === '30d' ? builderGrade30 : period === '7d' ? builderGrade7 : builderGrade60
  const tg = period === '30d' ? tokenMechanicGrade30 : period === '7d' ? tokenMechanicGrade7 : tokenMechanicGrade60
  const ig = period === '30d' ? integrityGrade30 : period === '7d' ? integrityGrade7 : integrityGrade60
  const stats = period === '30d' ? stats30d : period === '7d' ? stats7d : stats60d

  return (
    <div style={{ marginBottom: '40px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: isMobile ? '8px' : 0,
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Grades
        </div>

        <PeriodToggle />
      </div>

      {pulse30 && pulse7 && pulse60 && (
        <EcosystemPulsePanel pulse30={pulse30} pulse7={pulse7} pulse60={pulse60} />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
          gap: isMobile ? '10px' : '12px',
          alignItems: 'stretch',
        }}
      >
        <GradeCard
          isMobile={isMobile}
          grade={bg}
          label="builder activity"
          period={period}
          mini="Recent GitHub activity quality across the selected window."
          summary={bg?.summary ?? 'GitHub data unavailable'}
          trendExplanation={bg?.trendExplanation}
          footer={
            stats && (
              <>
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{stats.commits} commits</span>
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{stats.activeDays} active days</span>
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{stats.newRepos} new repos</span>
              </>
            )
          }
        />

        <GradeCard
          isMobile={isMobile}
          grade={tg}
          label="burn apps (economic)"
          period={period}
          mini={
            period === '60d'
              ? 'Commit-weighted token mechanic scores for direct/supply-lock repos only — infra excluded.'
              : 'Burn-app economic scores only — infra and tools excluded from this average.'
          }
          summary={tg?.summary ?? 'Token mechanic score unavailable'}
          trendExplanation={tg?.trendExplanation}
          footer={
            tg?.counts && (
              <>
                {tg.counts.repos > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.repos} repos in sample</span>
                )}
                {period === '60d' || !tg.tagCommits ? (
                  <>
                    {tg.counts.direct > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.direct} high-TM commits</span>
                    )}
                    {tg.counts.lock > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.lock} mid-TM commits</span>
                    )}
                    {tg.counts.indirect > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.indirect} low-TM commits</span>
                    )}
                  </>
                ) : (
                  <>
                    {tg.counts.direct > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.direct} high-TM commits</span>
                    )}
                    {tg.counts.lock > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.lock} mid-TM commits</span>
                    )}
                    {tg.counts.indirect > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.indirect} low-TM commits</span>
                    )}
                    {tg.tagCommits.direct > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.tagCommits.direct} direct-tag commits</span>
                    )}
                    {tg.tagCommits.lock > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.tagCommits.lock} supply-lock commits</span>
                    )}
                    {tg.tagCommits.indirect > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.tagCommits.indirect} indirect commits</span>
                    )}
                    {tg.tagCommits.infra > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.tagCommits.infra} infra/R&D commits</span>
                    )}
                  </>
                )}
              </>
            )
          }
        />

        <GradeCard
          isMobile={isMobile}
          grade={ig}
          label="Builder Integrity"
          period={period}
          mini="Commit-weighted trust & safety on consumer apps and supply-lock repos (infra excluded)."
          summary={ig?.summary ?? 'Integrity score unavailable'}
          trendExplanation={ig?.trendExplanation}
          footer={
            ig && (
              <>
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{integrityGradeFootnote()}</span>
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.active} repos in sample</span>
                {ig.counts.commitWeight > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.commitWeight} commits weighted</span>
                )}
                {ig.counts.high > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.high} high-integrity commits</span>
                )}
                {ig.counts.mid > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.mid} mid commits</span>
                )}
                {ig.counts.low > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.low} low-integrity commits</span>
                )}
              </>
            )
          }
        />
      </div>
    </div>
  )
}
