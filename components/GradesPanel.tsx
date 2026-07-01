'use client'

import { useState } from 'react'
import { BuilderGrade, HolderRelevanceGrade, IntegrityGrade, formatTrendPct, TrendExplanation } from '@/lib/grades'

interface Props {
  builderGrade30: BuilderGrade | null
  builderGrade7: BuilderGrade | null
  holderGrade30: HolderRelevanceGrade | null
  holderGrade7: HolderRelevanceGrade | null
  integrityGrade30: IntegrityGrade | null
  integrityGrade7: IntegrityGrade | null
  stats30d: { commits: number; activeDays: number; newRepos: number } | null
  stats7d: { commits: number; activeDays: number; newRepos: number } | null
}

function levelColor(level: 'high' | 'mid' | 'low') {
  if (level === 'high') return 'var(--green)'
  if (level === 'mid') return 'var(--amber)'
  return 'var(--red)'
}

function gradeColor(letter: string) {
  if (letter === 'A') return 'var(--accent)'
  if (letter === 'B') return 'var(--green)'
  if (letter === 'C') return 'var(--amber)'
  return 'var(--red)'
}

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
}: {
  grade: {
    letter: string
    trend: 'up' | 'flat' | 'down'
    trendPct: number | null
    signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[]
  } | null
  label: string
  mini: string
  summary: string
  period: '30d' | '7d'
  footer?: React.ReactNode
  trendExplanation?: TrendExplanation
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
            }}
          >
            <span
              style={{
                fontSize: '40px',
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

      {trendExplanation && (
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {grade?.signals.map(s => (
          <div
            key={s.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 64px 28px',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
              {s.label}
            </span>

            <div
              style={{
                width: '64px',
                height: '4px',
                background: 'var(--surface-3)',
                borderRadius: '99px',
                overflow: 'hidden',
                justifySelf: 'end',
              }}
            >
              <div
                style={{
                  width: `${s.pct}%`,
                  height: '100%',
                  borderRadius: '99px',
                  background: levelColor(s.level),
                }}
              />
            </div>

            <span
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                width: '28px',
                textAlign: 'right',
                textTransform: 'lowercase',
              }}
            >
              {s.level}
            </span>
          </div>
        ))}
      </div>

      {footer && (
        <div
          style={{
            marginTop: '12px',
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
  builderGrade30,
  builderGrade7,
  holderGrade30,
  holderGrade7,
  integrityGrade30,
  integrityGrade7,
  stats30d,
  stats7d,
}: Props) {
  const [period, setPeriod] = useState<'30d' | '7d'>('30d')

  const bg = period === '30d' ? builderGrade30 : builderGrade7
  const hg = period === '30d' ? holderGrade30 : holderGrade7
  const ig = period === '30d' ? integrityGrade30 : integrityGrade7
  const stats = period === '30d' ? stats30d : stats7d

  return (
    <div style={{ marginBottom: '28px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Grades
        </div>

        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--surface-1)',
            borderRadius: '6px',
            padding: '3px',
          }}
        >
          {(['30d', '7d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: '4px',
                background: period === p ? 'var(--surface-3)' : 'transparent',
                color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: period === p ? 500 : 400,
                transition: 'all 0.15s',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '12px',
          alignItems: 'stretch',
        }}
      >
        <GradeCard
          grade={bg}
          label="builder grade"
          period={period}
          mini="Recent GitHub activity quality across the selected window."
          summary={bg?.summary ?? 'GitHub data unavailable'}
          trendExplanation={bg?.trendExplanation}
          footer={
            stats && (
              <>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stats.commits} commits</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stats.activeDays} active days</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stats.newRepos} new repos</span>
              </>
            )
          }
        />

        <GradeCard
          grade={hg}
          label="holder relevance"
          period={period}
          mini="Share of commit volume pointed at CLAWD holder value (weighted by commits per repo)."
          summary={hg?.summary ?? 'Holder relevance score unavailable'}
          trendExplanation={hg?.trendExplanation}
          footer={
            hg?.counts && (
              <>
                {hg.counts.repos > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hg.counts.repos} active repos</span>
                )}
                {hg.counts.direct > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hg.counts.direct} direct commits</span>
                )}
                {hg.counts.lock > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hg.counts.lock} supply-lock commits</span>
                )}
                {hg.counts.indirect > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hg.counts.indirect} indirect commits</span>
                )}
                {hg.counts.infra > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hg.counts.infra} infra/R&D commits</span>
                )}
              </>
            )
          }
        />

        <GradeCard
          grade={ig}
          label="integrity grade"
          period={period}
          mini="Commit-weighted fit to the stated builder-values frame (by rubric scores)."
          summary={ig?.summary ?? 'Integrity score unavailable'}
          trendExplanation={ig?.trendExplanation}
          footer={
            ig && (
              <>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ig.counts.active} repos in sample</span>
                {ig.counts.commitWeight > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ig.counts.commitWeight} commits weighted</span>
                )}
                {ig.counts.high > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ig.counts.high} high-integrity commits</span>
                )}
                {ig.counts.mid > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ig.counts.mid} mid commits</span>
                )}
                {ig.counts.low > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ig.counts.low} low-integrity commits</span>
                )}
              </>
            )
          }
        />
      </div>
    </div>
  )
}
