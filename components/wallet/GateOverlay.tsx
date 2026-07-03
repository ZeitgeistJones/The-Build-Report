'use client'

import type { ReactNode } from 'react'
import { useClawdAccess } from './ClawdAccessContext'
import { CLAWD_BUY_URL } from '@/lib/web3/constants'
import { useIsMobile } from '@/hooks/useIsMobile'

const panelStyle = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--text-primary)',
  background: 'var(--surface-2)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius)',
  padding: '12px 18px',
  textAlign: 'center' as const,
  lineHeight: 1.5,
  maxWidth: '360px',
  pointerEvents: 'auto' as const,
}

export default function GateOverlay() {
  const { isConnected, hasAccess, isWrongChain, connectWallet, switchToBase } = useClawdAccess()
  const isMobile = useIsMobile()

  let content: ReactNode

  if (!isConnected) {
    content = (
      <button
        type="button"
        onClick={connectWallet}
        style={{ ...panelStyle, cursor: 'pointer' }}
      >
        Connect wallet — hold 10M $CLAWD to unlock the full report
      </button>
    )
  } else if (isWrongChain) {
    content = (
      <button
        type="button"
        onClick={switchToBase}
        style={{ ...panelStyle, cursor: 'pointer' }}
      >
        Switch to Base to verify your $CLAWD balance
      </button>
    )
  } else if (!hasAccess) {
    content = (
      <div style={panelStyle}>
        You&apos;re connected but need 10M $CLAWD to unlock.{' '}
        <a
          href={CLAWD_BUY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)', fontWeight: 500 }}
        >
          Get $CLAWD →
        </a>
      </div>
    )
  } else {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: isMobile ? '12px 16px 24px' : '12px 24px 24px',
        background:
          'linear-gradient(to bottom, transparent 0px, rgba(14, 14, 14, 0.45) 80px, rgba(14, 14, 14, 0.55) 100%)',
        borderRadius: 'var(--radius-lg)',
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      {content}
    </div>
  )
}
