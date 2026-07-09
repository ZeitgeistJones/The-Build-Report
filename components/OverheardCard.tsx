import type { OverheardData } from '@/lib/overheard'

interface Props {
  overheard: OverheardData | null
}

export default function OverheardCard({ overheard }: Props) {
  if (!overheard) return null

  const lines = overheard.format === 'list'
    ? overheard.text.split('\n').filter(Boolean)
    : [overheard.text]

  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
        height: '100%',
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
          Overheard
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {overheard.mentionCount} mention{overheard.mentionCount === 1 ? '' : 's'} on Slop.Computer
        </span>
      </div>

      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            margin: i === 0 ? 0 : '6px 0 0',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
          }}
        >
          {line}
        </p>
      ))}

      <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Reflects mentions published in the last 24 hours
      </p>
    </div>
  )
}
