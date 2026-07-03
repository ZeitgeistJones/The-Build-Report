'use client'

import { useRef, useState, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
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
const TOOLTIP_WIDTH = 240

interface Props {
  adminNote?: string
}

export default function ScoreTypeBadge({ adminNote }: Props) {
  const isMobile = useIsMobile()
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
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

  useLayoutEffect(() => {
    if (!show || !buttonRef.current) {
      setPos(null)
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    const panelWidth = Math.min(TOOLTIP_WIDTH, window.innerWidth - 32)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
    setPos({ top: rect.bottom + 6, left })
  }, [show, isMobile])

  return (
    <>
      <button
        ref={buttonRef}
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
      {show && pos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            background: 'var(--surface-3)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            width: Math.min(TOOLTIP_WIDTH, window.innerWidth - 32),
            zIndex: 9999,
            pointerEvents: 'none',
            textAlign: 'left',
            boxShadow: 'var(--card-elevated)',
          }}
        >
          {tooltip}
        </div>,
        document.body,
      )}
    </>
  )
}
