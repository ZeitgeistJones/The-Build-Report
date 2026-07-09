import { NextRequest, NextResponse } from 'next/server'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { isRepoExcluded } from '@/lib/repoExclude'
import { buildPromoQuote, resolvePromoActivitySnapshot } from '@/lib/rescorePromo'
import { getTreasuryBalanceEth } from '@/lib/rescorePromoTreasury'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const repoSlug = req.nextUrl.searchParams.get('repoSlug')?.trim() ?? ''
  const walletAddress = req.nextUrl.searchParams.get('wallet')?.trim() || null

  if (!repoSlug) {
    return NextResponse.json({ ok: false, error: 'Missing repoSlug' }, { status: 400 })
  }

  if (shouldSkipRepo(repoSlug) || (await isRepoExcluded(repoSlug))) {
    return NextResponse.json({ ok: false, error: 'Repo not eligible' }, { status: 400 })
  }

  const activity = await resolvePromoActivitySnapshot(repoSlug)
  if (!activity) {
    return NextResponse.json({ ok: false, error: 'Repo not found' }, { status: 404 })
  }

  const treasuryBalanceEth = await getTreasuryBalanceEth()
  const quote = await buildPromoQuote(activity, treasuryBalanceEth, walletAddress)

  return NextResponse.json({
    ok: true,
    quote: {
      promoActive: quote.promoActive,
      promoEndsAt: quote.promoEndsAt,
      eligible: quote.eligible,
      staleCommits: quote.staleCommits,
      rewardEth: quote.rewardEth,
      treasuryFunded: quote.treasuryFunded,
      reason: quote.reason,
      buttonLabel: quote.buttonLabel,
      promoBanner: quote.promoBanner,
    },
  })
}
