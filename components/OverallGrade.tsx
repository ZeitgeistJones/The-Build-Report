'use client'

import { gradeColor } from '@/lib/gradeLetters'
import { formatTrendPct } from '@/lib/grades'
import { OverallGradeWithTrend } from '@/lib/overallGrade'
import { PeriodToggle, useGradePeriod } from './GradePeriodContext'

function TrendArrow({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  if (trend === 'up') return <span style={{ color: 'var(--green)', fontSize: '12px' }}>↑</span>
  if (trend === 'down') return <span style={{ color: 'var(--red)', fontSize: '12px' }}>↓</span>
  return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
}

interface Props {
  overall30: OverallGradeWithTrend
  overall7: OverallGradeWithTrend
  summary: string | null
}

export default function OverallGrade({ overall30, overall7, summary }: Props) {
  const { period } = useGradePeriod()
  const overall = period === '30d' ? overall30 : overall7

  return (
    <div
      style={{
        marginTop: '16px',
        marginBottom: '20px',
        padding: '16px 18px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Overall grade
        </div>
        <PeriodToggle />
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
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: summary && period === '30d' ? '10px' : 0 }}>
        Based on {overall.reposScored} repos scored
      </div>

      {summary && period === '30d' && (
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          {summary}
        </p>
      )}
    </div>
  )
}
