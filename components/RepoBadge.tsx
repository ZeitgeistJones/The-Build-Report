'use client'

import { useRef, useState, useLayoutEffect, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '@/hooks/useIsMobile'

const HOVER_DELAY_MS = 400
const TOOLTIP_WIDTH = 240

interface Props {
  tooltip: string
  children: ReactNode
  style?: CSSProperties
  as?: 'span' | 'button'
  onClick?: (e: React.MouseEvent) => void
}

export default function RepoBadge({ tooltip, children, style, as = 'span', onClick }: Props) {
  const isMobile = useIsMobile()
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLSpanElement & HTMLButtonElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (onClick) onClick(e)
    if (isMobile) {
      e.stopPropagation()
      setShow(s => !s)
    }
  }

  useLayoutEffect(() => {
    if (!show || !ref.current) {
      setPos(null)
      return
    }
    const rect = ref.current.getBoundingClientRect()
    const panelWidth = Math.min(TOOLTIP_WIDTH, window.innerWidth - 32)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
    setPos({ top: rect.bottom + 6, left })
  }, [show, isMobile])

  const commonProps = {
    ref,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onClick: handleClick,
    style: { ...style, cursor: as === 'button' || isMobile ? 'pointer' : 'default' } as CSSProperties,
  }

  return (
    <>
      {as === 'button' ? (
        <button type="button" {...commonProps}>
          {children}
        </button>
      ) : (
        <span {...commonProps}>{children}</span>
      )}
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
