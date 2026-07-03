'use client'

import { gradeColor } from '@/lib/gradeLetters'
import { formatTrendPct } from '@/lib/grades'
import { OverallGradeWithTrend } from '@/lib/overallGrade'
import { useGradePeriod } from './GradePeriodContext'

function TrendArrow({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  if (trend === 'up') return <span style={{ color: 'var(--green)', fontSize: '12px' }}>↑</span>
  if (trend === 'down') return <span style={{ color: 'var(--red)', fontSize: '12px' }}>↓</span>
  return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
}

interface Props {
  overall30: OverallGradeWithTrend
  overall7: OverallGradeWithTrend
  overall60: OverallGradeWithTrend
  summary: string | null
}

export default function OverallGrade({ overall30, overall7, overall60, summary }: Props) {
  const { period } = useGradePeriod()
  const overall = period === '30d' ? overall30 : period === '7d' ? overall7 : overall60

  return (
    <div
      style={{
        marginBottom: '12px',
        padding: '16px 18px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '10px',
        }}
      >
        Overall grade
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '42px',
            lineHeight: 1,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: gradeColor(overall.letter),
          }}
        >
          {overall.letter}
        </span>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
          }}
        >
          {overall.pct}%
        </span>
        {period !== '60d' && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <TrendArrow trend={overall.trend} />
          {formatTrendPct(overall.trendPct, period)}
        </span>
        )}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: period === '30d' && summary ? '10px' : period === '7d' || period === '60d' ? '10px' : 0 }}>
        Based on {overall.reposScored} repos scored
      </div>

      {period === '30d' && summary && (
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          {summary}
        </p>
      )}

      {period === '7d' && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
          Summary is available for the 30d window only.
        </p>
      )}

      {period === '60d' && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
          Grades are commit-weighted over the last 60 days. Summary is available for the 30d window only.
        </p>
      )}
    </div>
  )
}
