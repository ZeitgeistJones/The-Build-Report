import { NextResponse } from 'next/server'
import { getEthUsdRateCached, syncEthUsdRate } from '@/lib/ethUsdRate'
import { getRedis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

/** Cached ETH/USD for rescore price labels. ?refresh=1 forces a CoinGecko fetch. */
export async function GET(req: Request) {
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'

  if (refresh) {
    const synced = await syncEthUsdRate({ force: true })
    return NextResponse.json({
      ok: true,
      rate: synced.rate,
      updatedAt: synced.updatedAt,
      source: synced.source,
    })
  }

  const rate = await getEthUsdRateCached()
  let updatedAt: string | null = null
  try {
    updatedAt = await getRedis().get<string>('build-report:eth-usd:updatedAt')
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    rate,
    updatedAt,
    source: 'cache',
  })
}
