import { NextRequest, NextResponse } from 'next/server'
import { resolveRepoBeforeRescore } from '@/lib/autoscore'
import {
  issuePromoNonce,
  isPromoWindowOpen,
  buildPromoQuote,
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
    if (!activity?.scoredAt) {
      return NextResponse.json(
        { ok: false, error: 'Promo applies to rescored repos with commits since the last score' },
        { status: 400 },
      )
    }

    const treasuryBalanceEth = await getTreasuryBalanceEth()
    const quote = await buildPromoQuote(activity, treasuryBalanceEth, walletAddress)
    if (!quote.eligible) {
      return NextResponse.json(
        { ok: false, error: quote.reason ?? 'Repo is not eligible for promo rescore' },
        { status: 400 },
      )
    }

    const issued = await issuePromoNonce(walletAddress, repoSlug)
    return NextResponse.json({ ok: true, ...issued })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
