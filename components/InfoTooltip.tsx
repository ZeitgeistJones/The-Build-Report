'use client'

import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

const HOVER_DELAY_MS = 400

type Placement = 'above' | 'below'

interface Props {
  content: ReactNode
  ariaLabel: string
  icon?: 'info' | 'question'
  placement?: Placement
  width?: number
  /** When true, tooltip panel accepts clicks (e.g. links inside). */
  interactive?: boolean
  /** Smaller trigger for nested badges; keeps 14px on mobile. */
  compact?: boolean
}

export default function InfoTooltip({
  content,
  ariaLabel,
  icon = 'info',
  placement = 'below',
  width = 260,
  interactive = false,
  compact = false,
}: Props) {
  const isMobile = useIsMobile()
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  function scheduleShow() {
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => setShow(true), HOVER_DELAY_MS)
  }

  function handleMouseEnter() {
    if (isMobile) return
    scheduleShow()
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

  useEffect(() => {
    if (!show || !interactive) return
    function onDocClick() {
      setShow(false)
    }
    const timer = setTimeout(() => {
      document.addEventListener('click', onDocClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', onDocClick)
    }
  }, [show, interactive])

  useLayoutEffect(() => {
    if (!show || !anchorRef.current) {
      setPos(null)
      return
    }

    const rect = anchorRef.current.getBoundingClientRect()
    const panelWidth = isMobile ? Math.min(width, window.innerWidth - 32) : width
    const left = Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8))

    if (placement === 'above') {
      setPos({ top: rect.top - 6, left })
    } else {
      setPos({ top: rect.bottom + 6, left })
    }
  }, [show, isMobile, width, placement])

  const hitSize = isMobile ? MIN_TAP : compact ? 24 : 14
  const iconSize = compact ? 9 : icon === 'question' ? 9 : 11

  const panelStyle = {
    background: 'var(--surface-3)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)',
    padding: '8px 10px',
    fontSize: icon === 'question' ? '11px' : '12px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    textAlign: 'left' as const,
    boxShadow: 'var(--card-elevated)',
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        ref={anchorRef}
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        aria-label={ariaLabel}
        style={{
          width: hitSize,
          height: hitSize,
          minWidth: hitSize,
          minHeight: hitSize,
          borderRadius: '50%',
          background: icon === 'question' ? 'var(--surface-3)' : 'transparent',
          color: 'var(--text-muted)',
          fontSize: iconSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'default',
          padding: 0,
          border: 'none',
        }}
      >
        {icon === 'question' ? '?' : 'ⓘ'}
      </button>
      {show && pos && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            ...panelStyle,
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: placement === 'above' ? 'translateY(-100%)' : undefined,
            zIndex: 9999,
            pointerEvents: interactive ? 'auto' : 'none',
            width: isMobile ? Math.min(width, window.innerWidth - 32) : width,
          }}
        >
          {content}
        </div>,
        document.body,
      )}
    </div>
  )
}
