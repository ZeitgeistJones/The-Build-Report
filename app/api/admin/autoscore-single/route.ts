import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { resolveRepoBeforeRescore, runAutoscoreSingle } from '@/lib/autoscore'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { isRepoExcluded } from '@/lib/repoExclude'
import { fetchRecentCommitMessages, fetchCommits30dCount } from '@/lib/github'
import { bustOverallSummaryCache } from '@/lib/overallSummary'
import { recordRescoreBurn } from '@/lib/rescoreBurns'
import { generateRescoreChangeSummary } from '@/lib/rescoreChangeSummary'
import { buildRescoreSummaryRecord, saveRescoreSummary } from '@/lib/rescoreSummaries'
import { isCommunityContextEnabled, markAcceptedConsumed } from '@/lib/communityContext'
import { getRedis } from '@/lib/redis'
import { PAID_TX_KEY_PREFIX } from '@/lib/web3/constants'
import { verifyPaymentTx, verifyWalletSignature, walletHasGateAccess } from '@/lib/web3/verifyPayment'
import {
  consumePromoNonce,
  getPromoConfig,
  getWalletPromoPayoutCount,
  hasPromoPayout,
  isPromoWindowOpen,
  markPromoPayout,
  peekPromoNonce,
  promoSignMessage,
} from '@/lib/rescorePromo'
import { incrementEthPendingOptimistic, scheduleBurnSnapshotSync } from '@/lib/burnSnapshot'
import { sendPromoSplitReward, treasuryCanCover } from '@/lib/rescorePromoTreasury'
import { refreshNeedleAfterRescore } from '@/lib/needle'
import { appendScoreHistory } from '@/lib/scoreHistory'
import { getShippingLeverage, getTokenMechanicForDisplay, showsEconomicNa } from '@/lib/economicGrade'
import { reportFirstScanIfNeeded } from '@/lib/achievementReport'

export const maxDuration = 60

const ratelimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'build-report:rl:rescore',
})

async function runRescorePipeline(repoSlug: string) {
  const redis = getRedis()
  const oldRepo = await resolveRepoBeforeRescore(repoSlug)
  const [commitMessages, commits30dAtRescore] = await Promise.all([
    fetchRecentCommitMessages(repoSlug),
    fetchCommits30dCount(repoSlug),
  ])

  const repo = await runAutoscoreSingle(repoSlug)
  if (!repo) {
    throw new Error('Could not score repo')
  }

  const { summary: changeSummary, deltaHeader } = await generateRescoreChangeSummary({
    oldRepo,
    newRepo: repo,
    commitMessages,
  })

  const rescoreMeta = buildRescoreSummaryRecord({
    oldRepo,
    newRepo: repo,
    summary: changeSummary,
    deltaHeader,
    commits30dAtRescore,
  })
  await saveRescoreSummary(repoSlug, rescoreMeta, redis)
  
  const economicScore = showsEconomicNa(repo)
    ? getShippingLeverage(repo)
    : getTokenMechanicForDisplay(repo)

  await appendScoreHistory(repoSlug, {
    scoredAt: repo.scoredAt ?? new Date().toISOString(),
    builderIntegrityLetter: repo.builderIntegrity.letter,
    builderIntegrityPct: repo.builderIntegrity.pct,
    economicLetter: economicScore?.letter ?? null,
    economicPct: economicScore?.pct ?? null,
    economicLabel: showsEconomicNa(repo) ? 'shipping leverage' : 'holder economics',
  }, redis)

  await bustOverallSummaryCache(redis)
  if (isCommunityContextEnabled()) {
    await markAcceptedConsumed(repoSlug, new Date().toISOString())
  }

  return { repo, changeSummary, rescoreMeta }
}

export async function POST(req: NextRequest) {
  const redis = getRedis()
  let paidKey: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const repoSlug = typeof body.repoSlug === 'string' ? body.repoSlug.trim() : ''
    const txHash = typeof body.txHash === 'string' ? body.txHash.trim() : ''
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''
    const promoNonce = typeof body.promoNonce === 'string' ? body.promoNonce.trim() : ''
    const promoSignature = typeof body.promoSignature === 'string' ? body.promoSignature.trim() : ''
    const isPromoPath = Boolean(promoNonce && promoSignature && !txHash)

    if (!repoSlug || !walletAddress) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    if (!isPromoPath && !txHash) {
      return NextResponse.json({ ok: false, error: 'Missing payment or promo authorization' }, { status: 400 })
    }

    if (shouldSkipRepo(repoSlug)) {
      return NextResponse.json({ ok: false, error: 'Repo not eligible for scoring' }, { status: 400 })
    }

    if (await isRepoExcluded(repoSlug)) {
      return NextResponse.json({ ok: false, error: 'Repo is excluded from scoring' }, { status: 400 })
    }

    const hasAccess = await walletHasGateAccess(walletAddress)
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'Wallet does not meet CLAWDGate access requirements' }, { status: 403 })
    }

    const { success } = await ratelimit.limit(walletAddress.toLowerCase())
    if (!success) {
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded — max 3 rescores per hour per wallet' }, { status: 429 })
    }

    let promoTotalWei = BigInt(0)
    let promoRewardWei = BigInt(0)
    let promoRewardEth = 0
    let promoBurnFundWei = BigInt(0)
    let promoBurnFundEth = 0
    let promoTotalEth = 0

    if (isPromoPath) {
      if (!isPromoWindowOpen()) {
        return NextResponse.json({ ok: false, error: 'Promo is not active' }, { status: 400 })
      }

      if (await hasPromoPayout(walletAddress, repoSlug, promoNonce)) {
        return NextResponse.json({ ok: false, error: 'Promo reward already claimed for this attempt' }, { status: 400 })
      }

      const lockedPeek = await peekPromoNonce(walletAddress, repoSlug, promoNonce)
      if (!lockedPeek) {
        return NextResponse.json({ ok: false, error: 'Invalid or expired promo authorization' }, { status: 400 })
      }

      const validSig = await verifyWalletSignature(
        walletAddress,
        promoSignMessage(repoSlug, promoNonce, lockedPeek.rewardEth),
        promoSignature,
      )
      if (!validSig) {
        return NextResponse.json({ ok: false, error: 'Promo signature did not match wallet' }, { status: 401 })
      }

      const locked = await consumePromoNonce(walletAddress, repoSlug, promoNonce)
      if (!locked) {
        return NextResponse.json({ ok: false, error: 'Invalid or expired promo authorization' }, { status: 400 })
      }

      // Pay the amount locked at nonce issue (matches button quote) — do not recompute from live Redis.
      promoTotalWei = BigInt(locked.totalWei)
      promoRewardWei = BigInt(locked.rewardWei)
      promoRewardEth = locked.rewardEth
      promoBurnFundWei = BigInt(locked.burnFundWei)
      promoBurnFundEth = Number(promoBurnFundWei) / 1e18
      promoTotalEth = Number(promoTotalWei) / 1e18

      if (promoTotalWei <= BigInt(0) || promoRewardWei <= BigInt(0)) {
        return NextResponse.json({ ok: false, error: 'Repo is not eligible for promo reward' }, { status: 400 })
      }

      const config = getPromoConfig()
      if (config.maxPayoutsPerWallet) {
        const used = await getWalletPromoPayoutCount(walletAddress)
        if (used >= config.maxPayoutsPerWallet) {
          return NextResponse.json({ ok: false, error: 'Promo payout limit reached for this wallet' }, { status: 400 })
        }
      }

      if (!(await treasuryCanCover(promoTotalWei, true))) {
        return NextResponse.json({ ok: false, error: 'Promo treasury balance is too low' }, { status: 503 })
      }
    } else {
      if (isPromoWindowOpen()) {
        return NextResponse.json(
          { ok: false, error: 'Paid rescore is paused during the launch promo' },
          { status: 400 },
        )
      }

      paidKey = `${PAID_TX_KEY_PREFIX}${txHash}`
      const claimed = await redis.set(paidKey, 'pending', { nx: true, ex: 3600 })
      if (!claimed) {
        return NextResponse.json(
          { ok: false, error: 'Transaction already used or in progress' },
          { status: 400 },
        )
      }
      await verifyPaymentTx(txHash, walletAddress)
    }

    let pipeline
    try {
      pipeline = await runRescorePipeline(repoSlug)
      refreshNeedleAfterRescore()
    } catch (err) {
      if (paidKey) await redis.del(paidKey)
      throw err
    }

    console.log('achievement report wallet:', walletAddress)
    reportFirstScanIfNeeded(walletAddress)

    // #region agent log
    {
      const countBefore = await redis.get<number | string>('build-report:burns:rescore-count').catch(() => null)
      console.log('[rescore-count-debug]', JSON.stringify({
        hypothesisId: 'A',
        isPromoPath,
        countBefore,
        countBeforeType: typeof countBefore,
        willCallRecordRescoreBurn: !isPromoPath,
      }))
      fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',hypothesisId:'A',location:'autoscore-single/route.ts:post-pipeline',message:'rescore path before count update',data:{isPromoPath,countBefore,countBeforeType:typeof countBefore,willCallRecordRescoreBurn:!isPromoPath},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion

    if (isPromoPath) {
      let payoutResult: Awaited<ReturnType<typeof sendPromoSplitReward>>
      try {
        payoutResult = await sendPromoSplitReward(
          walletAddress,
          promoTotalWei,
          promoBurnFundWei,
          promoRewardWei,
        )
        await incrementEthPendingOptimistic(promoBurnFundEth)
        scheduleBurnSnapshotSync()
        // #region agent log
        {
          const countAfterPromo = await redis.get<number | string>('build-report:burns:rescore-count').catch(() => null)
          console.log('[rescore-count-debug]', JSON.stringify({
            hypothesisId: 'A-promo-exit',
            countAfterPromo,
            note: 'promo path does not call recordRescoreBurn',
          }))
          fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',hypothesisId:'A',location:'autoscore-single/route.ts:promo-success',message:'promo path completed without recordRescoreBurn',data:{countAfterPromo,promoBurnFundEth},timestamp:Date.now()})}).catch(()=>{});
        }
        // #endregion
      } catch (payoutErr) {
        console.error('[autoscore-single] promo payout failed after rescore:', payoutErr)
        // #region agent log
        console.log('[rescore-count-debug]', JSON.stringify({ hypothesisId: 'D', note: 'promo payout failed; count not incremented' }))
        fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',hypothesisId:'D',location:'autoscore-single/route.ts:promo-payout-fail',message:'promo payout failed',data:{err:payoutErr instanceof Error ? payoutErr.message : String(payoutErr)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return NextResponse.json({
          ok: true,
          repo: pipeline.repo,
          changeSummary: pipeline.changeSummary,
          rescoreMeta: pipeline.rescoreMeta,
          promo: {
            rewardEth: promoRewardEth,
            payoutTxHash: null,
            payoutPending: true,
            payoutError: payoutErr instanceof Error ? payoutErr.message : 'Payout failed',
          },
        })
      }

      const walletConfirmed = payoutResult.walletTx.confirmed
      await markPromoPayout(
        walletAddress,
        repoSlug,
        promoNonce,
        payoutResult.walletTx.hash,
        promoRewardEth,
        promoTotalEth,
      )

      return NextResponse.json({
        ok: true,
        repo: pipeline.repo,
        changeSummary: pipeline.changeSummary,
        rescoreMeta: pipeline.rescoreMeta,
        promo: {
          rewardEth: promoRewardEth,
          burnFundEth: promoBurnFundEth,
          payoutTxHash: payoutResult.walletTx.hash,
          burnFundTxHash: payoutResult.burnFundTx.hash,
          payoutPending: !walletConfirmed,
          payoutError: walletConfirmed
            ? null
            : 'Reward sent — waiting for Base confirmation. Check your wallet in a minute.',
        },
      })
    }

    if (paidKey) await redis.set(paidKey, `complete:${repoSlug}`)
    // #region agent log
    console.log('[rescore-count-debug]', JSON.stringify({ hypothesisId: 'B', note: 'calling recordRescoreBurn on paid path' }))
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',hypothesisId:'B',location:'autoscore-single/route.ts:paid-path',message:'about to recordRescoreBurn',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await recordRescoreBurn(redis)
    // #region agent log
    {
      const countAfterPaid = await redis.get<number | string>('build-report:burns:rescore-count').catch(() => null)
      console.log('[rescore-count-debug]', JSON.stringify({ hypothesisId: 'B-after', countAfterPaid, countAfterType: typeof countAfterPaid }))
      fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',hypothesisId:'B',location:'autoscore-single/route.ts:after-record',message:'after recordRescoreBurn',data:{countAfterPaid,countAfterType:typeof countAfterPaid},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion

    return NextResponse.json({
      ok: true,
      repo: pipeline.repo,
      changeSummary: pipeline.changeSummary,
      rescoreMeta: pipeline.rescoreMeta,
    })
  } catch (err: unknown) {
    if (paidKey) {
      await redis.del(paidKey).catch(() => {})
    }
    const message = err instanceof Error ? err.message : 'Request failed'
    console.error('[autoscore-single] rescore failed:', message)
    return NextResponse.json({ ok: false, error: 'Rescore failed' }, { status: 400 })
  }
}
