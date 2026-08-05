'use client'

import type { Level } from '@/lib/scores'
import { LEVEL_BAR_COLORS, rubricRowPoints } from '@/lib/rubricDisplay'
import { shortenSourceForNormieDisplay } from '@/lib/normieSourceDisplay'

interface Props {
  label: string
  weight: string
  level: Level
  source: string
  /** Plain-English rewrite when Plain English mode is on. */
  sourceNormie?: string | null
  isMobile: boolean
  deltaEarned?: number | null
  levelChangeLabel?: string | null
  isNewRow?: boolean
  /** @deprecated Notes are always open in both modes. Kept for call-site compat. */
  collapsibleSource?: boolean
  /** When true, prefer sourceNormie if present. */
  preferNormieSource?: boolean
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
  sourceNormie = null,
  isMobile,
  deltaEarned = null,
  levelChangeLabel = null,
  isNewRow = false,
  preferNormieSource = false,
}: Props) {
  const { earned, max } = rubricRowPoints(weight, level)
  const fillPct = max > 0 ? (earned / max) * 100 : 0
  const barColor = LEVEL_BAR_COLORS[level]
  const technical = source.trim()
  // Prefer stored AI rewrite; otherwise clip technical so Plain English never shows empty.
  const plain =
    sourceNormie?.trim() ||
    (preferNormieSource && technical ? shortenSourceForNormieDisplay(technical) : '')
  const showingPlain = Boolean(preferNormieSource && plain)
  const displaySource = showingPlain ? plain : technical
  const showSource = displaySource.length > 0
  const showDelta = deltaEarned != null
  const deltaBadge = showDelta ? formatDeltaBadge(deltaEarned, isNewRow) : null

  // Same chrome in both modes — only type scale differs.
  const bodyFontSize = showingPlain ? (isMobile ? '15px' : '16px') : isMobile ? '12px' : '13px'
  const bodyLineHeight = showingPlain ? 1.5 : 1.45
  const bodyColor = showingPlain ? 'var(--text)' : 'var(--text-secondary)'

  return (
    <div style={{ marginBottom: showingPlain ? '12px' : '10px' }}>
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
        <p
          style={{
            margin: '4px 0 0',
            fontSize: bodyFontSize,
            color: bodyColor,
            lineHeight: bodyLineHeight,
          }}
        >
          {displaySource}
        </p>
      )}
    </div>
  )
}
