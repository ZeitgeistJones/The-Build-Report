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
  shouldConfirmRescore,
  type RepoActivitySnapshot,
} from '@/lib/rescoreGuards'
import { countCommitsSinceScore } from '@/lib/commitsSinceScore'
import InfoTooltip from '@/components/InfoTooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'
import {
  isLaunchBaseline,
  RESCORE_BUTTON_TOOLTIP,
  RESCORE_PROMO_TOOLTIP,
} from '@/lib/scoringCopy'
import { SCORE_PAYMENT_ETH } from '@/lib/rescoreBurns'
import { formatApproxUsdFromEth, formatRescorePriceLabel } from '@/lib/promoUsd'
import { useEthUsdRate } from '@/components/EthUsdProvider'
import PromoRewardToast from '@/components/PromoRewardToast'
import { playPromoRewardChime, primePromoRewardAudio } from '@/lib/promoRewardFx'

/** Fixed action column so grade metrics line up across cards. */
const ACTION_SLOT_WIDTH = 188
const RESCORE_BUTTON_MIN_HEIGHT = 22

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

function RescoreTooltipContent({
  promoActive,
  promoEligible,
  paused,
  staleCommits,
  rewardEth,
  pausedReason,
  ethUsdRate,
}: {
  promoActive: boolean
  promoEligible: boolean
  paused: boolean
  staleCommits: number
  rewardEth: number
  pausedReason: string | null
  ethUsdRate: number
}) {
  return (
    <>
      {promoEligible && (
        <div style={{ marginBottom: '6px' }}>
          Earn {formatApproxUsdFromEth(rewardEth, ethUsdRate)} for {staleCommits} stale commit
          {staleCommits === 1 ? '' : 's'} on this repo.
        </div>
      )}
      {paused && (
        <div style={{ marginBottom: '6px' }}>
          Paid rescore is paused during the launch promo.
          {pausedReason ? ` ${pausedReason}` : ' No stale commits to trigger a free promo rescore either.'}
        </div>
      )}
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
  const [promoReward, setPromoReward] = useState<{
    amountLabel: string
    pending: boolean
    txUrl: string | null
  } | null>(null)

  const { sendTransactionAsync, isPending: isSending } = useSendTransaction()
  const { signMessageAsync } = useSignMessage()

  const ethUsdRate = useEthUsdRate()
  const label = scoringStatus === 'unscored' ? 'Score' : 'Rescore'
  const promoEligible = Boolean(promoQuote?.eligible)
  const paidRescorePaused =
    scoringStatus === 'scored' && Boolean(promoQuote?.promoActive) && !promoEligible
  const busy = phase !== 'idle' || isSending
  const buttonDisabled = busy || paidRescorePaused
  const defaultLabel = `${label} (${formatRescorePriceLabel(SCORE_PAYMENT_ETH, ethUsdRate)})`
  const actionLabel = busy
    ? phase === 'paying' || isSending
      ? 'Paying…'
      : phase === 'signing'
        ? 'Signing…'
        : 'Scoring…'
    : paidRescorePaused
      ? 'Up to date'
    : promoEligible
      ? `${label} · earn ${formatApproxUsdFromEth(promoQuote?.rewardEth ?? 0, ethUsdRate)}`
      : defaultLabel
  const { hasNew: hasNewCommitsSinceScore } = countCommitsSinceScore(
    activity.scoredAt,
    activity.commitTimestamps,
    { lastCommitAt: activity.lastCommitAt, pushedAt: activity.pushedAt },
  )
  const scoredAndReady = scoringStatus === 'scored' && Boolean(activity.scoredAt)
  const canRescore = !buttonDisabled && (promoEligible || !promoQuote?.promoActive)
  const nudgeRescore = scoredAndReady && hasNewCommitsSinceScore && canRescore
  const nudgeBaselineRefresh =
    scoredAndReady && isLaunchBaseline(activity.adminNote) && !nudgeRescore && canRescore

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

    if (data.promo?.payoutTxHash) {
      const amt = formatApproxUsdFromEth(Number(data.promo.rewardEth ?? 0), ethUsdRate)
      const txUrl = `https://basescan.org/tx/${data.promo.payoutTxHash}`
      setPromoReward({
        amountLabel: amt,
        pending: Boolean(data.promo.payoutPending),
        txUrl,
      })
      playPromoRewardChime()
    } else if (data.promo?.payoutPending) {
      setError(data.promo.payoutError ?? 'Promo rescore saved but reward payout failed.')
      setInlineMsg('Rescore saved — expand card to see what changed.')
    } else if (data.promo) {
      setInlineMsg('Rescore saved — expand card to see what changed.')
    } else {
      setInlineMsg('Rescore saved — expand card to see what changed.')
    }

    window.setTimeout(() => {
      router.refresh()
    }, 1200)
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

    primePromoRewardAudio()

    try {
      const freshQuote = await fetchPromoQuote(repoSlug, address)
      if (freshQuote) setPromoQuote(freshQuote)
      const usePromo = Boolean(freshQuote?.eligible)
      // First-time Score on unscored repos stays paid during the promo — earn path is for stale rescored repos only.
      const allowPaidFirstScore = scoringStatus === 'unscored'

      if (usePromo) {
        await runPromoRescore()
      } else if (freshQuote?.promoActive && !allowPaidFirstScore) {
        throw new Error('Paid rescore is paused during the launch promo')
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
    setPromoReward(null)

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
    if (paidRescorePaused) return

    if (scoringStatus === 'scored' && shouldConfirmRescore(activity) && !confirmOpen && promoEligible) {
      setConfirmOpen(true)
      return
    }

    await runRescore()
  }

  const tooltip = (
    <InfoTooltip
      content={
        <RescoreTooltipContent
          promoActive={Boolean(promoQuote?.promoActive)}
          promoEligible={promoEligible}
          paused={paidRescorePaused}
          staleCommits={promoQuote?.staleCommits ?? 0}
          rewardEth={promoQuote?.rewardEth ?? 0}
          pausedReason={promoQuote?.reason ?? null}
          ethUsdRate={ethUsdRate}
        />
      }
      ariaLabel="About Score and Rescore"
      icon="question"
      placement="above"
      width={260}
      interactive
      compact
    />
  )

  return (
    <div
      style={{
        position: 'relative',
        width: isMobile ? '100%' : ACTION_SLOT_WIDTH,
        flexShrink: 0,
        alignSelf: 'flex-start',
        paddingTop: '3px',
        textAlign: 'center',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          width: '100%',
          minHeight: isMobile ? MIN_TAP : RESCORE_BUTTON_MIN_HEIGHT,
        }}
      >
        {paidRescorePaused ? (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              lineHeight: 1.3,
              textAlign: 'center',
              padding: isMobile ? '8px 4px' : '4px 4px',
            }}
          >
            Up to date
          </span>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={buttonDisabled}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: isMobile ? MIN_TAP : RESCORE_BUTTON_MIN_HEIGHT,
              fontSize: '11px',
              padding: isMobile ? '8px 8px' : '4px 8px',
              borderRadius: '99px',
              border: promoEligible ? '1px solid var(--accent-border)' : '1px solid var(--border)',
              background: promoEligible ? 'var(--accent-dim)' : 'var(--surface-2)',
              color: busy ? 'var(--text-muted)' : promoEligible ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: buttonDisabled ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1.2,
              textAlign: 'center',
              whiteSpace: isMobile ? 'nowrap' : 'normal',
              overflow: 'hidden',
              boxSizing: 'border-box',
              wordBreak: 'break-word',
            }}
          >
            {actionLabel}
          </button>
        )}
        {tooltip}
      </div>

      {nudgeRescore && (
        <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 500, marginTop: '5px', lineHeight: 1.3 }}>
          Rescore to update ↑
        </div>
      )}
      {nudgeBaselineRefresh && (
        <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 500, marginTop: '5px', lineHeight: 1.3 }}>
          Rescore to refresh ↑
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
              ? `This repo has ${promoQuote?.staleCommits ?? 0} stale commit${promoQuote?.staleCommits === 1 ? '' : 's'} since the last score — earn ${formatApproxUsdFromEth(promoQuote?.rewardEth ?? 0, ethUsdRate)}. Continue?`
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

      {promoReward && !confirmOpen && (
        <PromoRewardToast
          amountLabel={promoReward.amountLabel}
          pending={promoReward.pending}
          txUrl={promoReward.txUrl}
        />
      )}
      {inlineMsg && !confirmOpen && !promoReward && (
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
