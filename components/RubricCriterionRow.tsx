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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        marginBottom: '6px',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}
    >
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
          paddingTop: '2px',
        }}
        title={`${earned} of ${max} points (${level})`}
      >
        <div
          style={{
            width: isMobile ? 56 : 72,
            height: 6,
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
              transition: 'width 0.2s ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            minWidth: '38px',
            textAlign: 'right',
          }}
        >
          {earned}/{max}
        </span>
      </div>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          maxWidth: isMobile ? undefined : '220px',
          width: isMobile ? '100%' : undefined,
          textAlign: isMobile ? 'left' : 'right',
          lineHeight: 1.3,
          flexShrink: isMobile ? 1 : 0,
        }}
      >
        {source}
      </span>
    </div>
  )
}
