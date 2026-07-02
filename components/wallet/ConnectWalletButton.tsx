'use client'

import { useClawdAccess } from './ClawdAccessContext'

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
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

  if (isWrongChain) {
    return (
      <button
        type="button"
        onClick={switchToBase}
        disabled={isLoading}
        style={{
          fontSize: '12px',
          padding: '4px 11px',
          borderRadius: '99px',
          border: '1px solid var(--accent-border)',
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          cursor: 'pointer',
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
          fontSize: '12px',
          padding: '4px 11px',
          borderRadius: '99px',
          border: '1px solid var(--accent-border)',
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
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
      style={{
        fontSize: '12px',
        padding: '4px 11px',
        borderRadius: '99px',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      Connect wallet
    </button>
  )
}
