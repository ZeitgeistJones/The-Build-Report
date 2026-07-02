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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'rgba(14, 14, 14, 0.55)',
        borderRadius: 'var(--radius-lg)',
        zIndex: 2,
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
        }}
      >
        Connect wallet — hold 10M $CLAWD to unlock the full report
      </button>
    </div>
  )
}
