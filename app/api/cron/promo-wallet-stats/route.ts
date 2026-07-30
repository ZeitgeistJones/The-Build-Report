import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WALLET_PREFIX = 'build-report:promo:wallet-payouts:'
const PAYOUT_PREFIX = 'build-report:promo-payout:'

async function scanPrefix(match: string): Promise<string[]> {
  const r = getRedis()
  let cursor = '0'
  const keys: string[] = []
  do {
    const result = await r.scan(cursor, { match, count: 200 })
    const next = String(result[0])
    const batch = (result[1] ?? []) as string[]
    cursor = next
    for (const key of batch) keys.push(String(key))
  } while (cursor !== '0')
  return keys
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const r = getRedis()
    const walletKeys = await scanPrefix(`${WALLET_PREFIX}*`)
    const payoutKeys = await scanPrefix(`${PAYOUT_PREFIX}*`)

    const wallets: { wallet: string; payouts: number }[] = []
    for (const key of walletKeys) {
      const wallet = key.slice(WALLET_PREFIX.length)
      if (!wallet) continue
      const raw = await r.get<number | string>(key)
      const payouts = typeof raw === 'number' ? raw : Number(raw) || 0
      wallets.push({ wallet, payouts })
    }
    wallets.sort((a, b) => b.payouts - a.payouts)

    const sponsoredCount = await r.get<number | string>('build-report:promo:sponsored-count')
    const ethPaidTotal = await r.get<number | string>('build-report:promo:eth-paid-total')

    const payload = {
      ok: true,
      uniqueWallets: wallets.length,
      sponsoredPayoutEvents: sponsoredCount ?? 0,
      ethPaidTotal: ethPaidTotal ?? 0,
      activePayoutDedupKeys: payoutKeys.length,
      topWallets: wallets.slice(0, 25),
      generatedAt: new Date().toISOString(),
    }

    console.log('[promo-wallet-stats]', JSON.stringify({
      uniqueWallets: payload.uniqueWallets,
      sponsoredPayoutEvents: payload.sponsoredPayoutEvents,
      ethPaidTotal: payload.ethPaidTotal,
      activePayoutDedupKeys: payload.activePayoutDedupKeys,
      topWallets: payload.topWallets,
    }))

    return NextResponse.json(payload)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'promo wallet stats failed'
    console.error('[promo-wallet-stats] failed', err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
