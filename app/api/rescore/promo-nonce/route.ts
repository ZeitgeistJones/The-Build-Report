import { NextRequest, NextResponse } from 'next/server'
import { resolveRepoBeforeRescore } from '@/lib/autoscore'
import {
  issuePromoNonce,
  isPromoWindowOpen,
  buildPromoQuote,
  computePromoReward,
  resolvePromoActivitySnapshot,
} from '@/lib/rescorePromo'
import { getTreasuryBalanceEth } from '@/lib/rescorePromoTreasury'
import { walletHasGateAccess } from '@/lib/web3/verifyPayment'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!isPromoWindowOpen()) {
    return NextResponse.json({ ok: false, error: 'Promo is not active' }, { status: 404 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const repoSlug = typeof body.repoSlug === 'string' ? body.repoSlug.trim() : ''
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''

    if (!repoSlug || !walletAddress) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    const hasAccess = await walletHasGateAccess(walletAddress)
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'Wallet does not meet CLAWDGate access requirements' }, { status: 403 })
    }

    const activity = await resolvePromoActivitySnapshot(repoSlug)
    if (!activity) {
      return NextResponse.json({ ok: false, error: 'Repo not found' }, { status: 404 })
    }

    const treasuryBalanceEth = await getTreasuryBalanceEth()
    const quote = await buildPromoQuote(activity, treasuryBalanceEth, walletAddress)
    if (!quote.eligible || quote.rewardWei <= BigInt(0)) {
      return NextResponse.json(
        { ok: false, error: quote.reason ?? 'Repo is not eligible for promo score' },
        { status: 400 },
      )
    }

    // Lock the quoted reward into the nonce so payout cannot jump if score cache is flushed mid-run.
    const reward = computePromoReward(activity)
    if (reward.totalWei <= BigInt(0)) {
      return NextResponse.json({ ok: false, error: 'Repo is not eligible for promo reward' }, { status: 400 })
    }

    const issued = await issuePromoNonce(walletAddress, repoSlug, {
      staleCommits: reward.staleCommits,
      totalWei: reward.totalWei,
      rewardWei: reward.rewardWei,
      burnFundWei: reward.burnFundWei,
      rewardEth: reward.rewardEth,
    })
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'promo-lock',hypothesisId:'A',location:'app/api/rescore/promo-nonce/route.ts',message:'locked promo reward into nonce',data:{repoSlug,staleCommits:reward.staleCommits,rewardEth:reward.rewardEth,scoredAt:activity.scoredAt,unscored:!activity.scoredAt},timestamp:Date.now()})}).catch(()=>{});
    console.log('[promo-lock]', JSON.stringify({event:'nonce-lock',repoSlug,staleCommits:reward.staleCommits,rewardEth:reward.rewardEth}))
    // #endregion
    return NextResponse.json({ ok: true, ...issued })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
