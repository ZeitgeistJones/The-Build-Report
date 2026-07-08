import { NextRequest, NextResponse } from 'next/server'
import { guardDebugRoute } from '@/lib/debugAuth'
import { getPromoConfig, getPromoStatusForDisplay, isPromoWindowOpen } from '@/lib/rescorePromo'
import { getTreasuryAddress, getTreasuryBalanceEth } from '@/lib/rescorePromoTreasury'

export const dynamic = 'force-dynamic'

/** Promo config + treasury diagnostics — use ?key=CRON_SECRET */
export async function GET(req: NextRequest) {
  const denied = guardDebugRoute(req)
  if (denied) return denied

  const config = getPromoConfig()
  const status = getPromoStatusForDisplay()
  const treasuryAddress = getTreasuryAddress()
  const treasuryBalanceEth = await getTreasuryBalanceEth()

  return NextResponse.json({
    promoWindowOpen: isPromoWindowOpen(config),
    enabledFlag: config.enabled,
    hasTreasuryKey: Boolean(process.env.RESCORE_PROMO_TREASURY_PRIVATE_KEY?.trim()),
    endsAt: config.endsAt,
    pennyEth: config.pennyEth,
    walletRewardEth: config.walletRewardEth,
    burnSplitBps: 5000,
    maxCommits: config.maxCommits,
    minStale: config.minStale,
    minTreasuryEth: config.minTreasuryEth,
    maxPayoutsPerWallet: config.maxPayoutsPerWallet,
    treasuryAddress,
    treasuryBalanceEth,
    active: status.active,
  })
}
