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
import { type RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import InfoTooltip from '@/components/InfoTooltip'
import { RESCORE_BUTTON_TOOLTIP } from '@/lib/scoringCopy'

interface Props {
  repoSlug: string
  scoringStatus: ScoringStatus
  onScored: (repo: Repo, rescoreMeta?: RescoreSummaryRecord | null) => void
}

function RescoreTooltipContent() {
  return (
    <>
      {RESCORE_BUTTON_TOOLTIP}{' '}
      <a href="/about#score-types" style={{ color: 'var(--accent)' }} onClick={e => e.stopPropagation()}>
        About score types ↗
      </a>
    </>
  )
}

export default function RepoScoreButton({ repoSlug, scoringStatus, onScored }: Props) {
  const { isConnected, hasAccess, connectWallet, address, isWrongChain, switchToBase } = useClawdAccess()
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
      const rescoreMeta = data.rescoreMeta as RescoreSummaryRecord | undefined
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
        <InfoTooltip
          content={<RescoreTooltipContent />}
          ariaLabel="About Score and Rescore"
          icon="question"
          placement="above"
          width={240}
          interactive
        />
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
    </div>
  )
}
