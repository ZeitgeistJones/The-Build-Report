'use client'

import { useRef, useState } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  isLaunchBaseline,
  SCORE_TYPE_BASELINE_LABEL,
  SCORE_TYPE_BASELINE_TOOLTIP,
  SCORE_TYPE_LIVE_AI_LABEL,
  SCORE_TYPE_LIVE_AI_TOOLTIP,
  SCORE_TYPE_STYLES,
} from '@/lib/scoringCopy'

const HOVER_DELAY_MS = 400

interface Props {
  adminNote?: string
}

export default function ScoreTypeBadge({ adminNote }: Props) {
  const isMobile = useIsMobile()
  const [show, setShow] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const baseline = isLaunchBaseline(adminNote)
  const styles = baseline ? SCORE_TYPE_STYLES.baseline : SCORE_TYPE_STYLES.liveAi
  const label = baseline ? SCORE_TYPE_BASELINE_LABEL : SCORE_TYPE_LIVE_AI_LABEL
  const tooltip = baseline ? SCORE_TYPE_BASELINE_TOOLTIP : SCORE_TYPE_LIVE_AI_TOOLTIP

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  function handleMouseEnter() {
    if (isMobile) return
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => setShow(true), HOVER_DELAY_MS)
  }

  function handleMouseLeave() {
    if (isMobile) return
    clearHoverTimer()
    setShow(false)
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    clearHoverTimer()
    setShow(s => !s)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        aria-label={`${label} grade — ${tooltip}`}
        style={{
          fontSize: '10px',
          padding: '2px 8px',
          borderRadius: '99px',
          fontWeight: 500,
          color: styles.color,
          background: styles.bg,
          border: `1px solid ${styles.border}`,
          letterSpacing: '0.02em',
          cursor: 'default',
          lineHeight: 1.4,
        }}
      >
        {label}
      </button>
      {show && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            background: 'var(--surface-3)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            width: 'min(240px, calc(100vw - 32px))',
            zIndex: 10,
            pointerEvents: 'none',
            textAlign: 'left',
            boxShadow: 'var(--card-elevated)',
          }}
        >
          {tooltip}
        </div>
      )}
    </span>
  )
}
