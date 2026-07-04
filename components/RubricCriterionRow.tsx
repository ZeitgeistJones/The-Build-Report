import type { Level } from '@/lib/scores'
import { LEVEL_BAR_COLORS, rubricRowPoints } from '@/lib/rubricDisplay'

interface Props {
  label: string
  weight: string
  level: Level
  source: string
  isMobile: boolean
}

export default function RubricCriterionRow({ label, weight, level, source, isMobile }: Props) {
  const { earned, max } = rubricRowPoints(weight, level)
  const fillPct = max > 0 ? (earned / max) * 100 : 0
  const barColor = LEVEL_BAR_COLORS[level]
  const showSource = source.trim().length > 0

  return (
    <div
      style={{ marginBottom: '5px' }}
      title={showSource ? source : undefined}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minHeight: '20px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            flex: 1,
            minWidth: 0,
            lineHeight: 1.35,
          }}
        >
          {label}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            flexShrink: 0,
          }}
          title={`${earned} of ${max} points (${level})`}
        >
          <div
            style={{
              width: isMobile ? 48 : 64,
              height: 5,
              borderRadius: 3,
              background: 'var(--surface-2)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: `${fillPct}%`,
                height: '100%',
                background: barColor,
                borderRadius: 2,
              }}
            />
          </div>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              minWidth: '34px',
              textAlign: 'right',
            }}
          >
            {earned}/{max}
          </span>
        </div>
      </div>
      {showSource && (
        <p className="rubric-source-clamp" style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
          {source}
        </p>
      )}
    </div>
  )
}
