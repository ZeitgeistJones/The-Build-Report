'use client'

import { useClawdAccess } from './ClawdAccessContext'

export default function GateOverlay() {
  const { isConnected, connectWallet } = useClawdAccess()

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '12px 24px 24px',
        background:
          'linear-gradient(to bottom, transparent 0px, rgba(14, 14, 14, 0.45) 80px, rgba(14, 14, 14, 0.55) 100%)',
        borderRadius: 'var(--radius-lg)',
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (!isConnected) connectWallet()
        }}
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          padding: '12px 18px',
          cursor: isConnected ? 'default' : 'pointer',
          textAlign: 'center',
          lineHeight: 1.5,
          maxWidth: '360px',
          pointerEvents: 'auto',
        }}
      >
        Connect wallet — hold 10M $CLAWD to unlock the full report
      </button>
    </div>
  )
}
