import { NextRequest, NextResponse } from 'next/server'
import { guardDebugRoute } from '@/lib/debugAuth'
import { RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import { fetchOnChainBurnTotals } from '@/lib/clawdBurnIndex'
import { getBurnSnapshotForDisplay } from '@/lib/burnSnapshot'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Live Blockscout scan for debugging — not used by the homepage. */
export async function GET(req: NextRequest) {
  const denied = guardDebugRoute(req)
  if (denied) return denied

  const [live, cached] = await Promise.all([
    fetchOnChainBurnTotals([RECEIVER_BUY_AND_BURN]),
    getBurnSnapshotForDisplay(),
  ])

  return NextResponse.json({
    live: {
      clawdBurned: live.clawdBurned,
      lastBurnAt: live.lastBurnAt,
    },
    cached,
    match: live.clawdBurned === cached.clawdBurned && live.lastBurnAt === cached.lastBurnAt,
  })
}
