import type { BuildBriefData } from '@/lib/buildBrief'

interface Props {
  brief: BuildBriefData | null
}

export default function BuildBriefCard({ brief }: Props) {
  if (!brief?.text) return null

  const ageLabel = brief.isToday ? 'today' : 'yesterday'

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
          Build brief
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {ageLabel}
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
        {brief.text}
      </p>
      <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Based on sampled active repos · refreshes daily after autoscore
      </p>
    </div>
  )
}
