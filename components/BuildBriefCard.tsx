'use client'

import type { BuildBriefData } from '@/lib/buildBrief'
import { useNormieMode } from '@/components/NormieModeProvider'

interface Props {
  brief: BuildBriefData | null
}

function formatDigestDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return dateKey
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

export default function BuildBriefCard({ brief }: Props) {
  const { normie } = useNormieMode()
  if (!brief) return null
  const text = (normie && brief.generalNormie) || brief.general || brief.text
  if (!text) return null

  const dayLabel = brief.dateKey ? formatDigestDate(brief.dateKey) : 'yesterday'

  return (
    <div
      className="build-brief-card"
      style={{
        marginBottom: '20px',
        padding: '14px 16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Yesterday&apos;s build
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {dayLabel}
          {brief.repoCount > 0 && (
            <>
              {' '}
              · {brief.repoCount} repo{brief.repoCount === 1 ? '' : 's'}
              {brief.commitCount > 0 && ` · ${brief.commitCount} commits`}
            </>
          )}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: 1.65,
        }}
      >
        {text}
      </p>
      <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Plain-English summary · refreshes daily overnight Eastern
      </p>
    </div>
  )
}
