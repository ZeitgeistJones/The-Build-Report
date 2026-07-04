import type { Level } from '@/lib/scores'
import { LEVEL_BAR_COLORS, rubricRowPoints } from '@/lib/rubricDisplay'

interface Props {
  label: string
  weight: string
  level: Level
  source: string
  isMobile: boolean
  deltaEarned?: number | null
  levelChangeLabel?: string | null
  isNewRow?: boolean
}

function formatDeltaBadge(delta: number, isNewRow: boolean): { text: string; color: string } | null {
  if (isNewRow) return { text: 'new', color: 'var(--accent)' }
  if (delta === 0) return null
  if (delta > 0) return { text: `+${delta}`, color: '#5cb87a' }
  return { text: `${delta}`, color: '#e05c5c' }
}

export default function RubricCriterionRow({
  label,
  weight,
  level,
  source,
  isMobile,
  deltaEarned = null,
  levelChangeLabel = null,
  isNewRow = false,
}: Props) {
  const { earned, max } = rubricRowPoints(weight, level)
  const fillPct = max > 0 ? (earned / max) * 100 : 0
  const barColor = LEVEL_BAR_COLORS[level]
  const showSource = source.trim().length > 0
  const showDelta = deltaEarned != null
  const deltaBadge = showDelta ? formatDeltaBadge(deltaEarned, isNewRow) : null

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
          title={
            showDelta && deltaEarned !== 0
              ? `${levelChangeLabel ?? level}${deltaEarned != null ? ` (${deltaEarned > 0 ? '+' : ''}${deltaEarned} pts)` : ''}`
              : `${earned} of ${max} points (${level})`
          }
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
          {deltaBadge && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: deltaBadge.color,
                minWidth: '22px',
                textAlign: 'right',
              }}
            >
              {deltaBadge.text}
            </span>
          )}
        </div>
      </div>
      {levelChangeLabel && (
        <p style={{ margin: '1px 0 0', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
          {levelChangeLabel}
          {showDelta && deltaEarned !== 0 && (
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {' '}
              ({deltaEarned > 0 ? '+' : ''}
              {deltaEarned} pts)
            </span>
          )}
        </p>
      )}
      {showSource && (
        <p className="rubric-source-clamp" style={{ margin: '2px 0 0', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
          {source}
        </p>
      )}
    </div>
  )
}
