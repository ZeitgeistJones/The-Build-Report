'use client'

import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSendTransaction } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { base } from 'wagmi/chains'
import { Repo } from '@/lib/scores'
import { wagmiConfig } from '@/lib/wagmi/config'
import { RECEIVER_BUY_AND_BURN, SCORE_PAYMENT_WEI } from '@/lib/web3/constants'
import { ScoringStatus } from '@/lib/scoringStatus'
import { useClawdAccess } from './wallet/ClawdAccessContext'
import { type RescoreSummaryRecord } from '@/lib/rescoreSummaries'

const TOOLTIP =
  'Score this repo using Claude AI. Cost: 0.000008 ETH (~$0.02 at time of writing — ETH price fluctuates so actual USD cost may vary). Payment is burned as $CLAWD via the receiver-buy-and-burn contract, supporting the ecosystem. Result is cached — community benefits from your score.'

interface Props {
  repoSlug: string
  scoringStatus: ScoringStatus
  onScored: (repo: Repo, rescoreMeta?: RescoreSummaryRecord | null) => void
}

export default function RepoScoreButton({ repoSlug, scoringStatus, onScored }: Props) {
  const { isConnected, hasAccess, connectWallet, address, isWrongChain, switchToBase } = useClawdAccess()
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)
  const [inlineMsg, setInlineMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'paying' | 'scoring'>('idle')
  const tooltipAnchorRef = useRef<HTMLButtonElement>(null)

  const { sendTransactionAsync, isPending: isSending } = useSendTransaction()

  useLayoutEffect(() => {
    if (!showTooltip || !tooltipAnchorRef.current) {
      setTooltipPos(null)
      return
    }
    const rect = tooltipAnchorRef.current.getBoundingClientRect()
    setTooltipPos({
      top: rect.top - 6,
      left: Math.max(8, rect.right - 240),
    })
  }, [showTooltip])

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
      const rescoreMeta = data.rescoreMeta as RescoreSummaryRecord | undefined
      // #region agent log
      fetch('http://127.0.0.1:7800/ingest/fa4fae29-c280-4441-b40c-b48d21260f18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a33a7a'},body:JSON.stringify({sessionId:'a33a7a',location:'RepoScoreButton.tsx:handleClick',message:'autoscore API success',data:{repoSlug,returnedId:(data.repo as Repo)?.id,summaryLen:rescoreMeta?.summary?.length??0},timestamp:Date.now(),hypothesisId:'A,G'})}).catch(()=>{});
      // #endregion
      onScored(data.repo as Repo, rescoreMeta ?? null)
      setInlineMsg('Rescore saved — expand card to see what changed.')
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
          ref={tooltipAnchorRef}
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
        <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '4px', lineHeight: 1.3, maxWidth: '140px' }}>
          {inlineMsg}
        </div>
      )}
      {error && (
        <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: '4px', lineHeight: 1.3 }}>
          {error}
        </div>
      )}
      {showTooltip && tooltipPos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: 'translateY(-100%)',
            background: 'var(--surface-3)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            width: '240px',
            zIndex: 9999,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {TOOLTIP}
        </div>,
        document.body,
      )}
    </div>
  )
}
