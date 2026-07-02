'use client'

import { useState } from 'react'
import { useSendTransaction } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { base } from 'wagmi/chains'
import { Repo } from '@/lib/scores'
import { wagmiConfig } from '@/lib/wagmi/config'
import { RECEIVER_BUY_AND_BURN, SCORE_PAYMENT_WEI } from '@/lib/web3/constants'
import { ScoringStatus } from '@/lib/scoringStatus'
import { useClawdAccess } from './wallet/ClawdAccessContext'

const TOOLTIP =
  'Score this repo using Claude AI. Cost: 0.000008 ETH (~$0.02 at time of writing — ETH price fluctuates so actual USD cost may vary). Payment is burned as $CLAWD via the receiver-buy-and-burn contract, supporting the ecosystem. Result is cached — community benefits from your score.'

interface Props {
  repoSlug: string
  scoringStatus: ScoringStatus
  onScored: (repo: Repo) => void
}

export default function RepoScoreButton({ repoSlug, scoringStatus, onScored }: Props) {
  const { isConnected, hasAccess, connectWallet, address, isWrongChain, switchToBase } = useClawdAccess()
  const [showTooltip, setShowTooltip] = useState(false)
  const [inlineMsg, setInlineMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'paying' | 'scoring'>('idle')

  const { sendTransactionAsync, isPending: isSending } = useSendTransaction()

  const label = scoringStatus === 'unscored' ? 'Score' : 'Rescore'
  const busy = phase !== 'idle' || isSending

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setError(null)
    setInlineMsg(null)

    if (!isConnected) {
      connectWallet()
      return
    }
    if (isWrongChain) {
      switchToBase()
      return
    }
    if (!hasAccess) {
      setInlineMsg('Hold 10M $CLAWD to use this feature')
      return
    }
    if (!address) return

    try {
      setPhase('paying')
      const hash = await sendTransactionAsync({
        to: RECEIVER_BUY_AND_BURN,
        value: SCORE_PAYMENT_WEI,
        chainId: base.id,
      })
      setPhase('scoring')

      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
      if (receipt.status !== 'success') {
        throw new Error('Transaction failed')
      }

      const res = await fetch('/api/admin/autoscore-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoSlug,
          txHash: hash,
          walletAddress: address,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        throw new Error(data.error || 'Scoring failed')
      }
      onScored(data.repo as Repo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPhase('idle')
    }
  }

  return (
    <div
      style={{ position: 'relative', textAlign: 'center', minWidth: '72px' }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '99px',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: busy ? 'var(--text-muted)' : 'var(--text-secondary)',
            cursor: busy ? 'wait' : 'pointer',
            fontWeight: 500,
          }}
        >
          {busy ? (phase === 'paying' || isSending ? 'Paying…' : 'Scoring…') : label}
        </button>
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={e => {
            e.stopPropagation()
            setShowTooltip(s => !s)
          }}
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: 'var(--surface-3)',
            color: 'var(--text-muted)',
            fontSize: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'default',
          }}
        >
          ?
        </button>
      </div>
      {inlineMsg && (
        <div style={{ fontSize: '10px', color: 'var(--amber)', marginTop: '4px', lineHeight: 1.3 }}>
          {inlineMsg}
        </div>
      )}
      {error && (
        <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: '4px', lineHeight: 1.3 }}>
          {error}
        </div>
      )}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--surface-3)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            width: '240px',
            zIndex: 20,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {TOOLTIP}
        </div>
      )}
    </div>
  )
}
