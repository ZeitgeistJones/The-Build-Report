'use client'

import { useState } from 'react'
import { BuilderGrade, HolderRelevanceGrade, IntegrityGrade } from '@/lib/grades'

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
  summary,
  footer,
}: {
  grade: { letter: string; trend: 'up' | 'flat' | 'down'; signals: { label: string; level: 'high' | 'mid' | 'low'; pct: number }[] } | null
  label: string
  summary: string
  footer?: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
      display: 'grid',
      gridTemplateColumns: '72px 1fr',
      gap: '14px',
      alignItems: 'start',
      minHeight: '100%',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '38px',
          fontWeight: 600,
          lineHeight: 1,
          fontFamily: 'var(--font-mono)',
          color: grade ? gradeColor(grade.letter) : 'var(--text-muted)'
        }}>
          {grade?.letter ?? '—'}
        </div>
        {grade && (
          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
            <TrendArrow trend={grade.trend} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>vs prev</span>
          </div>
        )}
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.3 }}>
          {label}
        </div>
      </div>

      <div>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '8px' }}>
          {summary}
        </p>

        {grade?.signals.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', flex: 1, lineHeight: 1.3 }}>
              {s.label}
            </span>
            <div style={{ width: '52px', height: '3px', background: 'var(--surface-3)', borderRadius: '99px', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ width: `${s.pct}%`, height: '100%', borderRadius: '99px', background: levelColor(s.level) }} />
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '20px', textAlign: 'right', flexShrink: 0 }}>
              {s.level}
            </span>
          </div>
        ))}

        {footer && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GradesPanel({ builderGrade30, builderGrade7, holderGrade30, holderGrade7, integrityGrade30, integrityGrade7, stats30d, stats7d }: Props) {
  const [period, setPeriod] = useState<'30d' | '7d'>('30d')

  const bg = period === '30d' ? builderGrade30 : builderGrade7
  const hg = period === '30d' ? holderGrade30 : holderGrade7
  const ig = period === '30d' ? integrityGrade30 : integrityGrade7
  const stats = period === '30d' ? stats30d : stats7d

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Grades
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-1)', borderRadius: '6px', padding: '3px' }}>
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
          gap: '10px',
          alignItems: 'stretch',
        }}
      >
        <GradeCard
          grade={bg}
          label="builder grade"
          summary={bg?.summary ?? 'GitHub data unavailable'}
          footer={stats && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stats.commits} commits</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stats.activeDays} active days</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{stats.newRepos} new repos</span>
            </div>
          )}
        />

        <GradeCard
          grade={hg}
          label="holder relevance"
          summary={hg?.summary ?? 'GitHub data unavailable'}
          footer={hg?.counts && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {hg.counts.direct > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hg.counts.direct} direct</span>}
              {hg.counts.lock > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hg.counts.lock} lock</span>}
              {hg.counts.indirect > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hg.counts.indirect} indirect</span>}
              {hg.counts.infra > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hg.counts.infra} infra</span>}
            </div>
          )}
        />

        <GradeCard
          grade={ig}
          label="integrity grade"
          summary={ig?.summary ?? 'Integrity score unavailable'}
          footer={ig && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ig.counts.active} active</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ig.counts.high} high</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ig.counts.mid} mid</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ig.counts.low} low</span>
            </div>
          )}
        />
      </div>
    </div>
  )
}
