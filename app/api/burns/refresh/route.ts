import { NextRequest, NextResponse } from 'next/server'
import { refreshBurnAfterExecute, syncBurnSnapshot } from '@/lib/burnSnapshot'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/

/** Refresh burn tracker totals — used after execute() confirms on-chain. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { txHash?: string }
    const txHash = body.txHash?.trim()

    if (txHash && TX_HASH_RE.test(txHash)) {
      const snapshot = await refreshBurnAfterExecute(txHash as `0x${string}`)
      if (snapshot.appliedFromTx) {
        return NextResponse.json({
          ok: true,
          appliedFromTx: true,
          via: 'tx',
          snapshot: {
            clawdBurned: snapshot.clawdBurned,
            lastBurnAt: snapshot.lastBurnAt,
            ethPendingInReceiver: snapshot.ethPendingInReceiver,
          },
        })
      }
    }

    const snapshot = await syncBurnSnapshot()
    return NextResponse.json({
      ok: true,
      // Only tell the UI to hard-reload when the chain index actually succeeded.
      appliedFromTx: snapshot.scanOk,
      via: 'sync',
      scanOk: snapshot.scanOk,
      snapshot,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Burn refresh failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
