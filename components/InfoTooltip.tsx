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
  /** Accent link-style label instead of the ⓘ / ? icon. */
  textTrigger?: string
  /** Force the panel open (e.g. after a gated click). */
  forceOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function InfoTooltip({
  content,
  ariaLabel,
  icon = 'info',
  placement = 'below',
  width = 260,
  interactive = false,
  compact = false,
  textTrigger,
  forceOpen,
  onOpenChange,
}: Props) {
  const isMobile = useIsMobile()
  const [internalShow, setInternalShow] = useState(false)
  const controlled = typeof forceOpen === 'boolean'
  const show = controlled ? forceOpen : internalShow
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function setShow(next: boolean | ((prev: boolean) => boolean)) {
    const resolved = typeof next === 'function' ? next(show) : next
    if (!controlled) setInternalShow(resolved)
    onOpenChange?.(resolved)
  }

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
    if (!show || (!interactive && !textTrigger && !controlled)) return
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
  }, [show, interactive, textTrigger, controlled])

  useLayoutEffect(() => {
    if (!show || !anchorRef.current) {
      setPos(null)
      return
    }

    const rect = anchorRef.current.getBoundingClientRect()
    const panelWidth = isMobile ? Math.min(width, window.innerWidth - 32) : width
    const left = textTrigger
      ? Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
      : Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8))

    if (placement === 'above') {
      setPos({ top: rect.top - 6, left })
    } else {
      setPos({ top: rect.bottom + 6, left })
    }
  }, [show, isMobile, width, placement, textTrigger])

  const hitSize = isMobile ? MIN_TAP : compact ? 24 : 14
  const iconSize = compact ? 9 : icon === 'question' ? 9 : 11
  const panelInteractive = interactive || Boolean(textTrigger) || controlled

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
        style={
          textTrigger
            ? {
                fontSize: '12px',
                color: 'var(--accent)',
                textDecoration: 'none',
                background: 'transparent',
                border: 'none',
                padding: isMobile ? '8px 0' : 0,
                minHeight: isMobile ? MIN_TAP : undefined,
                cursor: 'pointer',
                fontWeight: 400,
                lineHeight: 1.4,
                textAlign: 'left',
              }
            : {
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
              }
        }
      >
        {textTrigger ?? (icon === 'question' ? '?' : 'ⓘ')}
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
            pointerEvents: panelInteractive ? 'auto' : 'none',
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
