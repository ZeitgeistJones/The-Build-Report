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
import { isCommunityContextEnabled, markAcceptedConsumed, formatAcceptedCommunityContext } from '@/lib/communityContext'
import { getRedis } from '@/lib/redis'
import { PAID_TX_KEY_PREFIX } from '@/lib/web3/constants'
import { verifyPaymentTx, verifyWalletSignature, walletHasGateAccess } from '@/lib/web3/verifyPayment'
import {
  computePromoReward,
  consumePromoNonce,
  getPromoConfig,
  getWalletPromoPayoutCount,
  hasPromoPayout,
  isPromoWindowOpen,
  markPromoPayout,
  peekPromoNonce,
  promoSignMessage,
  resolvePromoActivitySnapshot,
} from '@/lib/rescorePromo'
import { incrementEthPendingOptimistic, scheduleBurnSnapshotSync } from '@/lib/burnSnapshot'
import { sendPromoSplitReward, treasuryCanCover } from '@/lib/rescorePromoTreasury'

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

      if (!(await peekPromoNonce(walletAddress, repoSlug, promoNonce))) {
        return NextResponse.json({ ok: false, error: 'Invalid or expired promo authorization' }, { status: 400 })
      }

      const validSig = await verifyWalletSignature(
        walletAddress,
        promoSignMessage(repoSlug, promoNonce),
        promoSignature,
      )
      if (!validSig) {
        return NextResponse.json({ ok: false, error: 'Promo signature did not match wallet' }, { status: 401 })
      }

      const nonceOk = await consumePromoNonce(walletAddress, repoSlug, promoNonce)
      if (!nonceOk) {
        return NextResponse.json({ ok: false, error: 'Invalid or expired promo authorization' }, { status: 400 })
      }

      const beforeActivity = await resolvePromoActivitySnapshot(repoSlug)
      if (!beforeActivity?.scoredAt) {
        return NextResponse.json({ ok: false, error: 'Promo applies to rescored repos with commits since the last score' }, { status: 400 })
      }

      const reward = computePromoReward(beforeActivity)
      promoTotalWei = reward.totalWei
      promoRewardWei = reward.rewardWei
      promoRewardEth = reward.rewardEth
      promoBurnFundWei = reward.burnFundWei
      promoBurnFundEth = reward.burnFundEth
      promoTotalEth = reward.totalEth

      if (promoTotalWei <= BigInt(0)) {
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
        const beforeActivity = await resolvePromoActivitySnapshot(repoSlug)
        const isFirstScore = !beforeActivity?.scoredAt
        const acceptedContext = isCommunityContextEnabled()
          ? await formatAcceptedCommunityContext(repoSlug)
          : undefined
        if (!isFirstScore && !acceptedContext) {
          return NextResponse.json(
            { ok: false, error: 'Paid rescore is paused during the launch promo' },
            { status: 400 },
          )
        }
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
    } catch (err) {
      if (paidKey) await redis.del(paidKey)
      throw err
    }

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
      } catch (payoutErr) {
        console.error('[autoscore-single] promo payout failed after rescore:', payoutErr)
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
    await recordRescoreBurn(redis)

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
