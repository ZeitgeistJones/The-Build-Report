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
import {
  commitsSinceScoreLabel,
  shouldConfirmRescore,
  type RepoActivitySnapshot,
} from '@/lib/rescoreGuards'
import { countCommitsSinceScore } from '@/lib/commitsSinceScore'
import InfoTooltip from '@/components/InfoTooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'
import { formatScoredDateLabel, isLaunchBaseline, RESCORE_BUTTON_TOOLTIP } from '@/lib/scoringCopy'

interface Props {
  repoSlug: string
  scoringStatus: ScoringStatus
  activity: RepoActivitySnapshot
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

export default function RepoScoreButton({ repoSlug, scoringStatus, activity, onScored }: Props) {
  const isMobile = useIsMobile()
  const { isConnected, hasAccess, connectWallet, address, isWrongChain, switchToBase } = useClawdAccess()
  const [inlineMsg, setInlineMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'paying' | 'scoring'>('idle')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { sendTransactionAsync, isPending: isSending } = useSendTransaction()

  const label = scoringStatus === 'unscored' ? 'Score' : 'Rescore'
  const busy = phase !== 'idle' || isSending
  const showScoreMeta = scoringStatus === 'scored' && activity.scoredAt
  const { hasNew: hasNewCommitsSinceScore } = countCommitsSinceScore(
    activity.scoredAt,
    activity.commitTimestamps,
    { lastCommitAt: activity.lastCommitAt, pushedAt: activity.pushedAt },
  )
  const nudgeRescore = Boolean(showScoreMeta) && hasNewCommitsSinceScore && !busy
  const nudgeBaselineRefresh =
    Boolean(showScoreMeta) && isLaunchBaseline(activity.adminNote) && !nudgeRescore && !busy

  async function runRescore() {
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
      setConfirmOpen(false)
    }
  }

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

    if (scoringStatus === 'scored' && shouldConfirmRescore(activity) && !confirmOpen) {
      setConfirmOpen(true)
      return
    }

    await runRescore()
  }

  return (
    <div
      style={{ position: 'relative', textAlign: 'center', minWidth: '88px', maxWidth: '140px' }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '4px' }}>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          style={{
            fontSize: '11px',
            padding: isMobile ? '8px 12px' : '3px 8px',
            minHeight: isMobile ? MIN_TAP : undefined,
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

      {showScoreMeta && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '5px', lineHeight: 1.35 }}>
          <div>Last scored {formatScoredDateLabel(activity.scoredAt)}</div>
          <div style={nudgeRescore ? { color: 'var(--accent)', fontWeight: 500 } : undefined}>
            {commitsSinceScoreLabel(activity)}
          </div>
          {nudgeRescore && (
            <div style={{ color: 'var(--accent)', fontWeight: 500 }}>Rescore to update ↑</div>
          )}
          {nudgeBaselineRefresh && (
            <div style={{ color: 'var(--accent)', fontWeight: 500 }}>Rescore to refresh ↑</div>
          )}
        </div>
      )}

      {confirmOpen && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            textAlign: 'left',
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            No new commits and scoring context is up to date since the last score. Rescore anyway?
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={busy}
              onClick={e => {
                e.stopPropagation()
                void runRescore()
              }}
              style={{
                fontSize: '10px',
                padding: isMobile ? '8px 12px' : '4px 8px',
                minHeight: isMobile ? MIN_TAP : undefined,
                borderRadius: '99px',
                border: '1px solid var(--accent-border)',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                fontWeight: 500,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              Rescore anyway
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={e => {
                e.stopPropagation()
                setConfirmOpen(false)
              }}
              style={{
                fontSize: '10px',
                padding: isMobile ? '8px 12px' : '4px 8px',
                minHeight: isMobile ? MIN_TAP : undefined,
                borderRadius: '99px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {inlineMsg && !confirmOpen && (
        <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '4px', lineHeight: 1.3 }}>
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
