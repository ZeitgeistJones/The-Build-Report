import { getRedis } from '@/lib/redis'

const RATE_KEY = 'build-report:eth-usd:rate'
const UPDATED_AT_KEY = 'build-report:eth-usd:updatedAt'
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
const FETCH_TIMEOUT_MS = 8_000
/** Re-fetch CoinGecko at most once per week — two small Redis keys only. */
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000

export const FALLBACK_ETH_USD = 1738.93

function isCacheStale(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true
  const t = new Date(updatedAt).getTime()
  return Number.isNaN(t) || Date.now() - t >= REFRESH_MS
}

function rateFromEnv(): number | null {
  const raw =
    process.env.NEXT_PUBLIC_RESCORE_PROMO_ETH_USD?.trim() ??
    process.env.RESCORE_PROMO_ETH_USD?.trim()
  if (!raw) return null
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function fallbackEthUsdRate(): number {
  return rateFromEnv() ?? FALLBACK_ETH_USD
}

async function fetchEthUsdFromCoingecko(): Promise<number | null> {
  try {
    const res = await fetch(COINGECKO_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { ethereum?: { usd?: number } }
    const usd = data.ethereum?.usd
    return typeof usd === 'number' && Number.isFinite(usd) && usd > 0 ? usd : null
  } catch {
    return null
  }
}

export async function syncEthUsdRate(options?: {
  force?: boolean
}): Promise<{
  rate: number
  updatedAt: string
  source: 'coingecko' | 'cache' | 'fallback'
  skipped?: boolean
}> {
  const cached = await readCachedEthUsdRate()
  if (!options?.force && cached && !isCacheStale(cached.updatedAt)) {
    return { rate: cached.rate, updatedAt: cached.updatedAt, source: 'cache', skipped: true }
  }

  const fetched = await fetchEthUsdFromCoingecko()
  const updatedAt = new Date().toISOString()

  if (fetched != null) {
    try {
      const r = getRedis()
      await Promise.all([r.set(RATE_KEY, fetched), r.set(UPDATED_AT_KEY, updatedAt)])
    } catch {
      // still return fetched rate for this request
    }
    return { rate: fetched, updatedAt, source: 'coingecko' }
  }

  if (cached) {
    return { rate: cached.rate, updatedAt: cached.updatedAt, source: 'cache' }
  }

  const fallback = fallbackEthUsdRate()
  return { rate: fallback, updatedAt, source: 'fallback' }
}

async function readCachedEthUsdRate(): Promise<{ rate: number; updatedAt: string } | null> {
  try {
    const r = getRedis()
    const [rateRaw, updatedAt] = await Promise.all([
      r.get<number>(RATE_KEY),
      r.get<string>(UPDATED_AT_KEY),
    ])
    if (typeof rateRaw === 'number' && Number.isFinite(rateRaw) && rateRaw > 0) {
      return { rate: rateRaw, updatedAt: updatedAt ?? new Date().toISOString() }
    }
  } catch {
    // ignore
  }
  return null
}

/** Cached ETH/USD for labels; fetches CoinGecko when missing or older than one week. */
export async function getEthUsdRateCached(): Promise<number> {
  const cached = await readCachedEthUsdRate()
  if (cached && !isCacheStale(cached.updatedAt)) return cached.rate

  const synced = await syncEthUsdRate()
  return synced.rate
}
