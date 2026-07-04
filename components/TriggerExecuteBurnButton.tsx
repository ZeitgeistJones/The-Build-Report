'use client'

import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useClawdAccess } from '@/components/wallet/ClawdAccessContext'
import {
  RECEIVER_BUY_AND_BURN,
  RECEIVER_BUY_AND_BURN_ABI,
} from '@/lib/web3/constants'
import { formatEthAmount } from '@/lib/clawdBurnIndex'
import { MIN_TAP } from '@/lib/responsive'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  ethPending: number
  /** Smaller layout for homepage header */
  compact?: boolean
}

export default function TriggerExecuteBurnButton({ ethPending, compact = false }: Props) {
  const { isConnected, connectWallet, isWrongChain, switchToBase } = useClawdAccess()
  const isMobile = useIsMobile()
  const [error, setError] = useState<string | null>(null)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const busy = isPending || confirming
  const canBurn = ethPending > 0

  function handleClick() {
    setError(null)
    if (!isConnected) {
      connectWallet()
      return
    }
    if (isWrongChain) {
      switchToBase()
      return
    }
    if (!canBurn) {
      setError('No ETH waiting in the receiver contract right now.')
      return
    }

    writeContract(
      {
        address: RECEIVER_BUY_AND_BURN,
        abi: RECEIVER_BUY_AND_BURN_ABI,
        functionName: 'execute',
      },
      {
        onError: err => setError(err.message.split('\n')[0] ?? 'Transaction failed'),
      },
    )
  }

  let label = 'Execute burn'
  if (!isConnected) label = 'Connect'
  else if (isWrongChain) label = 'Switch to Base'
  else if (busy) label = 'Confirm…'
  else if (isSuccess) label = 'Submitted ✓'
  else if (canBurn && compact) label = `Execute burn · ${formatEthAmount(ethPending)} ETH`
  else if (!canBurn && compact && isConnected && !isWrongChain) label = 'No ETH pending'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: compact ? 'flex-end' : 'flex-start' }}>
      {!compact && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '420px' }}>
          Rescore ETH sits in the receiver until someone calls <code style={{ fontSize: '12px' }}>execute()</code>.
          Anyone can trigger it — you pay a small gas fee on Base; the contract swaps its ETH for CLAWD and sends it to dead.
        </p>
      )}

      {!compact && ethPending > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {formatEthAmount(ethPending)} ETH ready to swap (~{Math.round(ethPending / 0.000008)} rescores worth)
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={busy || (isConnected && !isWrongChain && !canBurn && !isSuccess)}
        style={{
          fontSize: compact ? '10px' : '13px',
          fontWeight: 600,
          padding: compact ? '4px 10px' : isMobile ? '12px 18px' : '10px 18px',
          minHeight: isMobile && !compact ? MIN_TAP : undefined,
          borderRadius: '99px',
          border: '1px solid var(--accent-border)',
          background: canBurn || !isConnected ? 'var(--accent-dim)' : 'var(--surface-2)',
          color: canBurn || !isConnected ? 'var(--accent)' : 'var(--text-muted)',
          cursor: busy ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </button>

      {isSuccess && hash && (
        <a
          href={`https://basescan.org/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '11px', color: 'var(--accent)' }}
          onClick={() => reset()}
        >
          View on Basescan ↗
        </a>
      )}

      {error && (
        <div style={{ fontSize: '11px', color: 'var(--red)', maxWidth: compact ? '200px' : '320px', lineHeight: 1.4 }}>
          {error}
        </div>
      )}

      {!compact && (
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          No 10M CLAWD required — only Base gas. Totals on this page refresh within a few minutes after the tx confirms.
        </p>
      )}
    </div>
  )
}
