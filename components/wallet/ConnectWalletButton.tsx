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

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1.2M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.7M3 7.5h17.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="14" r="1.2" fill="currentColor" />
    </svg>
  )
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
      onClick={connectWallet}
      disabled={isLoading}
      aria-label="Connect wallet"
      title="Connect wallet"
      style={{
        ...base,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        minWidth: isMobile ? MIN_TAP : undefined,
        padding: isMobile ? '8px' : base.padding,
      }}
    >
      {isMobile ? <WalletIcon /> : 'Connect wallet'}
    </button>
  )
}
