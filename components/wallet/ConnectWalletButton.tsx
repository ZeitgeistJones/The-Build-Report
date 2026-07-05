'use client'

import { useClawdAccess } from './ClawdAccessContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function walletButtonStyle(isMobile: boolean): React.CSSProperties {
  return {
    fontSize: '12px',
    padding: isMobile ? '8px 14px' : '4px 11px',
    minHeight: isMobile ? MIN_TAP : undefined,
    borderRadius: '99px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

export default function ConnectWalletButton() {
  const {
    isConnected,
    address,
    isWrongChain,
    connectWallet,
    disconnectWallet,
    switchToBase,
    isLoading,
  } = useClawdAccess()
  const isMobile = useIsMobile()
  const base = walletButtonStyle(isMobile)

  if (isWrongChain) {
    return (
      <button
        type="button"
        onClick={switchToBase}
        disabled={isLoading}
        style={{
          ...base,
          border: '1px solid var(--accent-border)',
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
        }}
      >
        Switch to Base
      </button>
    )
  }

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={disconnectWallet}
        title={address}
        style={{
          ...base,
          border: '1px solid var(--accent-border)',
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {truncateAddress(address)}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        // #region agent log
        fetch('http://127.0.0.1:7483/ingest/84e5d7e1-b2bc-4b0e-8677-7b0875f46cc6', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8818b3' },
          body: JSON.stringify({
            sessionId: '8818b3',
            location: 'ConnectWalletButton.tsx:click',
            message: 'Connect wallet button clicked',
            data: { isLoading, isMobile, source: 'navbar' },
            timestamp: Date.now(),
            hypothesisId: 'H1',
            runId: 'pre-fix',
          }),
        }).catch(() => {})
        // #endregion
        connectWallet()
      }}
      disabled={isLoading}
      style={{
        ...base,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-secondary)',
      }}
    >
      Connect wallet
    </button>
  )
}
