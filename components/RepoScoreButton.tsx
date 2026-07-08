'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSendTransaction, useSignMessage } from 'wagmi'
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
import {
  formatScoredDateLabel,
  isLaunchBaseline,
  RESCORE_BUTTON_TOOLTIP,
  RESCORE_PROMO_TOOLTIP,
} from '@/lib/scoringCopy'
import { SCORE_PAYMENT_ETH } from '@/lib/rescoreBurns'
import { formatEthAmount } from '@/lib/clawdBurnIndex'

interface Props {
  repoSlug: string
  scoringStatus: ScoringStatus
  activity: RepoActivitySnapshot
  onScored: (repo: Repo, rescoreMeta?: RescoreSummaryRecord | null) => void
}

type PromoQuote = {
  promoActive: boolean
  eligible: boolean
  staleCommits: number
  rewardEth: number
  buttonLabel: string
  promoBanner: string | null
  reason: string | null
}

function RescoreTooltipContent({ promoActive }: { promoActive: boolean }) {
  return (
    <>
      {promoActive ? RESCORE_PROMO_TOOLTIP : RESCORE_BUTTON_TOOLTIP}{' '}
      <a href="/about#score-types" style={{ color: 'var(--accent)' }} onClick={e => e.stopPropagation()}>
        About score types ↗
      </a>
    </>
  )
}

export default function RepoScoreButton({ repoSlug, scoringStatus, activity, onScored }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { isConnected, hasAccess, connectWallet, address, isWrongChain, switchToBase } = useClawdAccess()
  const [inlineMsg, setInlineMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'paying' | 'signing' | 'scoring'>('idle')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [promoQuote, setPromoQuote] = useState<PromoQuote | null>(null)
  const [payoutTxUrl, setPayoutTxUrl] = useState<string | null>(null)

  const { sendTransactionAsync, isPending: isSending } = useSendTransaction()
  const { signMessageAsync } = useSignMessage()

  const label = scoringStatus === 'unscored' ? 'Score' : 'Rescore'
  const promoEligible = Boolean(promoQuote?.eligible)
  const busy = phase !== 'idle' || isSending
  const defaultLabel = `${label} (${SCORE_PAYMENT_ETH} ETH)`
  const actionLabel = busy
    ? phase === 'paying' || isSending
      ? 'Paying…'
      : phase === 'signing'
        ? 'Signing…'
        : 'Scoring…'
    : promoEligible
      ? (promoQuote?.buttonLabel ?? defaultLabel)
      : defaultLabel
  const showScoreMeta = scoringStatus === 'scored' && activity.scoredAt
  const { hasNew: hasNewCommitsSinceScore } = countCommitsSinceScore(
    activity.scoredAt,
    activity.commitTimestamps,
    { lastCommitAt: activity.lastCommitAt, pushedAt: activity.pushedAt },
  )
  const nudgeRescore = Boolean(showScoreMeta) && hasNewCommitsSinceScore && !busy
  const nudgeBaselineRefresh =
    Boolean(showScoreMeta) && isLaunchBaseline(activity.adminNote) && !nudgeRescore && !busy

  useEffect(() => {
    let cancelled = false
    void fetchPromoQuote(repoSlug, address).then(quote => {
      if (!cancelled) setPromoQuote(quote)
    })
    return () => {
      cancelled = true
    }
  }, [repoSlug, address, activity.scoredAt, activity.commitTimestamps, activity.lastCommitAt, activity.pushedAt])

  async function fetchPromoQuote(slug: string, wallet: string | undefined): Promise<PromoQuote | null> {
    const params = new URLSearchParams({ repoSlug: slug })
    if (wallet) params.set('wallet', wallet)
    try {
      const res = await fetch(`/api/rescore/promo-quote?${params.toString()}`)
      const data = await res.json()
      return data.ok ? (data.quote as PromoQuote) : null
    } catch {
      return null
    }
  }

  async function submitRescore(body: Record<string, string>) {
    const res = await fetch('/api/admin/autoscore-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data.ok) {
      throw new Error(data.error || 'Scoring failed')
    }
    const rescoreMeta = data.rescoreMeta as RescoreSummaryRecord | undefined
    onScored(data.repo as Repo, rescoreMeta ?? null)
    router.refresh()

    if (data.promo?.payoutTxHash) {
      const amt = formatEthAmount(Number(data.promo.rewardEth ?? 0))
      setPayoutTxUrl(`https://basescan.org/tx/${data.promo.payoutTxHash}`)
      if (data.promo.payoutPending) {
        setInlineMsg(`Rescore saved — ${amt} ETH payout sent (confirming on Base).`)
      } else {
        setInlineMsg(`Rescore saved — ${amt} ETH sent to your wallet.`)
      }
    } else if (data.promo?.payoutPending) {
      setError(data.promo.payoutError ?? 'Promo rescore saved but reward payout failed.')
    } else if (data.promo) {
      setInlineMsg('Rescore saved — expand card to see what changed.')
    } else {
      setInlineMsg('Rescore saved — expand card to see what changed.')
    }
  }

  async function runPromoRescore() {
    if (!address) return

    setPhase('signing')
    const nonceRes = await fetch('/api/rescore/promo-nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoSlug, walletAddress: address }),
    })
    const nonceData = await nonceRes.json()
    if (!nonceData.ok) {
      throw new Error(nonceData.error || 'Could not start promo rescore')
    }

    const signature = await signMessageAsync({ message: nonceData.message })
    setPhase('scoring')
    await submitRescore({
      repoSlug,
      walletAddress: address,
      promoNonce: nonceData.nonce,
      promoSignature: signature,
    })
  }

  async function runPaidRescore() {
    if (!address) return

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

    await submitRescore({
      repoSlug,
      txHash: hash,
      walletAddress: address,
    })
  }

  async function runRescore() {
    if (!address) return

    try {
      const freshQuote = await fetchPromoQuote(repoSlug, address)
      if (freshQuote) setPromoQuote(freshQuote)
      const usePromo = Boolean(freshQuote?.eligible)

      if (usePromo) {
        await runPromoRescore()
      } else {
        await runPaidRescore()
      }
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
    setPayoutTxUrl(null)

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
      style={{ position: 'relative', textAlign: 'center', minWidth: '88px', maxWidth: promoEligible ? '180px' : '140px' }}
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
            border: promoEligible ? '1px solid var(--accent-border)' : '1px solid var(--border)',
            background: promoEligible ? 'var(--accent-dim)' : 'var(--surface-2)',
            color: busy ? 'var(--text-muted)' : promoEligible ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: busy ? 'wait' : 'pointer',
            fontWeight: 500,
          }}
        >
          {actionLabel}
        </button>
        <InfoTooltip
          content={<RescoreTooltipContent promoActive={Boolean(promoQuote?.promoActive)} />}
          ariaLabel="About Score and Rescore"
          icon="question"
          placement="above"
          width={260}
          interactive
        />
      </div>

      {promoQuote?.promoBanner && promoEligible && (
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '5px', lineHeight: 1.35, maxWidth: '180px', marginInline: 'auto' }}>
          {promoQuote.promoBanner}
        </div>
      )}

      {promoQuote?.promoActive && !promoEligible && promoQuote.reason && (
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '5px', lineHeight: 1.35, maxWidth: '180px', marginInline: 'auto' }}>
          {promoQuote.reason}
        </div>
      )}

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
            {promoEligible
              ? `This repo has ${promoQuote?.staleCommits ?? 0} stale commit${promoQuote?.staleCommits === 1 ? '' : 's'} since the last score — free rescore plus ~${promoQuote?.rewardEth ?? 0} ETH reward. Continue?`
              : 'No new commits and scoring context is up to date since the last score. Rescore anyway?'}
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
          {payoutTxUrl && (
            <>
              {' '}
              <a
                href={payoutTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}
                onClick={e => e.stopPropagation()}
              >
                View tx ↗
              </a>
            </>
          )}
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
