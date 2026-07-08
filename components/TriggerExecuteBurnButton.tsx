'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useClawdAccess } from '@/components/wallet/ClawdAccessContext'
import {
  RECEIVER_BUY_AND_BURN,
  RECEIVER_BUY_AND_BURN_ABI,
} from '@/lib/web3/constants'
import { MIN_TAP } from '@/lib/responsive'
import { useIsMobile } from '@/hooks/useIsMobile'
import InfoTooltip from '@/components/InfoTooltip'
import { NOTHING_PENDING_TOOLTIP } from '@/lib/burnTrackerCopy'

interface Props {
  ethPending: number
  /** Smaller layout for homepage header */
  compact?: boolean
  /** Stretch button to card width (burn tracker card on mobile) */
  fullWidth?: boolean
}

export default function TriggerExecuteBurnButton({ ethPending, compact = false, fullWidth = false }: Props) {
  const router = useRouter()
  const { isConnected, connectWallet, isWrongChain, switchToBase } = useClawdAccess()
  const isMobile = useIsMobile()
  const [error, setError] = useState<string | null>(null)
  const [refreshingTotals, setRefreshingTotals] = useState(false)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const busy = isPending || confirming || refreshingTotals
  const canBurn = ethPending > 0

  useEffect(() => {
    if (!isSuccess || !hash) return

    let cancelled = false
    const delays = [0, 3000, 10000, 25000]

    async function refreshTotals(attempt: number) {
      if (cancelled) return
      setRefreshingTotals(true)
      try {
        const res = await fetch('/api/burns/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash: hash }),
        })
        const data = await res.json()
        if (!cancelled) router.refresh()
        if (!cancelled && !data.appliedFromTx && attempt < delays.length - 1) {
          window.setTimeout(() => refreshTotals(attempt + 1), delays[attempt + 1]! - delays[attempt]!)
          return
        }
      } catch {
        if (!cancelled && attempt < delays.length - 1) {
          window.setTimeout(() => refreshTotals(attempt + 1), delays[attempt + 1]! - delays[attempt]!)
          return
        }
      } finally {
        if (!cancelled) setRefreshingTotals(false)
      }
    }

    void refreshTotals(0)
    return () => {
      cancelled = true
    }
  }, [isSuccess, hash, router])

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
    if (!canBurn && !isSuccess) {
      setError('No swap waiting in the receiver contract right now.')
      return
    }
    if (isSuccess && hash) {
      window.open(`https://basescan.org/tx/${hash}`, '_blank', 'noopener,noreferrer')
      reset()
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
  else if (busy) label = refreshingTotals ? 'Updating totals…' : 'Confirm…'
  else if (isSuccess && compact) label = 'Submitted ✓ · Basescan'
  else if (isSuccess) label = 'Submitted ✓'
  else if (canBurn && compact) label = 'Execute burn'
  else if (!canBurn && compact && isConnected && !isWrongChain) label = 'Nothing pending'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        alignItems: fullWidth ? 'stretch' : compact ? 'flex-end' : 'flex-start',
        width: fullWidth ? '100%' : undefined,
        maxWidth: compact && !fullWidth ? '200px' : undefined,
      }}
    >
      {!compact && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '420px' }}>
          Rescore payments sit in the receiver until someone calls <code style={{ fontSize: '12px' }}>execute()</code>.
          Anyone can trigger it — you pay Base gas; the contract swaps for CLAWD and sends it to dead.
        </p>
      )}

      {!compact && ethPending > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Swap batch ready (~{Math.max(1, Math.round(ethPending / 0.000008))} rescores worth)
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          justifyContent: fullWidth ? 'stretch' : compact ? 'flex-end' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
        }}
      >
        <button
          type="button"
          onClick={handleClick}
          disabled={busy || (isConnected && !isWrongChain && !canBurn && !isSuccess)}
          style={{
            fontSize: compact ? '10px' : '13px',
            fontWeight: 600,
            padding: compact ? '6px 12px' : isMobile ? '12px 18px' : '10px 18px',
            minHeight: isMobile && !compact ? MIN_TAP : undefined,
            borderRadius: '99px',
            border: '1px solid var(--accent-border)',
            background: canBurn || !isConnected || isSuccess ? 'var(--accent-dim)' : 'var(--surface-2)',
            color: canBurn || !isConnected || isSuccess ? 'var(--accent)' : 'var(--text-muted)',
            cursor: busy ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
            width: fullWidth ? '100%' : undefined,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </button>
        {compact && !canBurn && isConnected && !isWrongChain && !busy && !isSuccess && (
          <InfoTooltip
            content={NOTHING_PENDING_TOOLTIP}
            ariaLabel="Why nothing is pending"
            icon="question"
            compact
            width={260}
          />
        )}
      </div>

      {isSuccess && hash && !compact && (
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
          No 10M CLAWD required — only Base gas. Totals update shortly after execute() confirms.
        </p>
      )}
    </div>
  )
}
