import { Redis } from '@upstash/redis'
import { getRedis } from '@/lib/redis'
import { getClawdUsdPrice, getEthAndClawdUsdPrices, getEthUsdPrice } from '@/lib/coingecko'
import { SCORE_PAYMENT_WEI } from '@/lib/web3/constants'

const RESCORE_COUNT_KEY = 'build-report:burns:rescore-count'
const ETH_TOTAL_KEY = 'build-report:burns:eth-total'
const CLAWD_TOTAL_KEY = 'build-report:burns:clawd-total'
const CLAWD_USD_CACHE_KEY = 'build-report:burns:clawd-usd-cache'
const CLAWD_PER_RESCORE_CACHE_KEY = 'build-report:burns:clawd-per-rescore-cache'

/** Fallback CLAWD tokens per rescore when price APIs fail entirely. */
const CLAWD_TOKENS_PER_RESCORE_FALLBACK = 1_000_000

export const SCORE_PAYMENT_ETH = Number(SCORE_PAYMENT_WEI) / 1e18

export type RescoreBurnStats = {
  count: number
  ethTotal: number
  clawdTotal: number
  clawdDisplay: number
}

async function cacheClawdPricing(redisClient: Redis, clawdUsd: number, clawdBurned: number): Promise<void> {
  await Promise.all([
    redisClient.set(CLAWD_USD_CACHE_KEY, clawdUsd),
    redisClient.set(CLAWD_PER_RESCORE_CACHE_KEY, clawdBurned),
  ])
}

async function estimateClawdBurnedThisRescore(redisClient: Redis): Promise<number> {
  try {
    const { ethUsd, clawdUsd } = await getEthAndClawdUsdPrices()
    const clawdBurned = (SCORE_PAYMENT_ETH * ethUsd) / clawdUsd
    await cacheClawdPricing(redisClient, clawdUsd, clawdBurned)
    return clawdBurned
  } catch (err) {
    console.warn('[rescoreBurns] CoinGecko full price fetch failed:', err)
  }

  try {
    const [ethUsd, cachedClawdUsd] = await Promise.all([
      getEthUsdPrice(),
      redisClient.get<number>(CLAWD_USD_CACHE_KEY),
    ])
    if (typeof cachedClawdUsd === 'number' && cachedClawdUsd > 0) {
      const clawdBurned = (SCORE_PAYMENT_ETH * ethUsd) / cachedClawdUsd
      await redisClient.set(CLAWD_PER_RESCORE_CACHE_KEY, clawdBurned)
      console.warn('[rescoreBurns] Using cached CLAWD USD price for burn estimate')
      return clawdBurned
    }
  } catch (err) {
    console.warn('[rescoreBurns] ETH + cached CLAWD fallback failed:', err)
  }

  try {
    const clawdUsd = await getClawdUsdPrice()
    const ethUsd = await getEthUsdPrice()
    const clawdBurned = (SCORE_PAYMENT_ETH * ethUsd) / clawdUsd
    await cacheClawdPricing(redisClient, clawdUsd, clawdBurned)
    console.warn('[rescoreBurns] Using partial CoinGecko fetch for burn estimate')
    return clawdBurned
  } catch (err) {
    console.warn('[rescoreBurns] Partial CoinGecko fallback failed:', err)
  }

  const cachedPerRescore = await redisClient.get<number>(CLAWD_PER_RESCORE_CACHE_KEY)
  if (typeof cachedPerRescore === 'number' && cachedPerRescore > 0) {
    console.warn('[rescoreBurns] Using cached CLAWD-per-rescore estimate')
    return cachedPerRescore
  }

  console.warn('[rescoreBurns] Using fixed CLAWD-per-rescore fallback')
  return CLAWD_TOKENS_PER_RESCORE_FALLBACK
}

export async function recordRescoreBurn(redisClient: Redis): Promise<void> {
  const clawdBurned = await estimateClawdBurnedThisRescore(redisClient)

  await Promise.all([
    redisClient.incr(RESCORE_COUNT_KEY),
    redisClient.incrbyfloat(ETH_TOTAL_KEY, SCORE_PAYMENT_ETH),
    redisClient.incrbyfloat(CLAWD_TOTAL_KEY, clawdBurned),
  ])
}

async function estimateClawdDisplayFromEth(
  redisClient: Redis,
  ethTotal: number,
  storedClawd: number,
): Promise<number> {
  if (storedClawd > 0) return storedClawd
  if (ethTotal <= 0) return 0

  const cachedPerRescore = await redisClient.get<number>(CLAWD_PER_RESCORE_CACHE_KEY)
  if (typeof cachedPerRescore === 'number' && cachedPerRescore > 0) {
    return (ethTotal / SCORE_PAYMENT_ETH) * cachedPerRescore
  }

  const cachedClawdUsd = await redisClient.get<number>(CLAWD_USD_CACHE_KEY)
  if (typeof cachedClawdUsd === 'number' && cachedClawdUsd > 0) {
    try {
      const ethUsd = await getEthUsdPrice()
      return (ethTotal * ethUsd) / cachedClawdUsd
    } catch {
      // fall through
    }
  }

  return (ethTotal / SCORE_PAYMENT_ETH) * CLAWD_TOKENS_PER_RESCORE_FALLBACK
}

export async function getRescoreBurnStats(): Promise<RescoreBurnStats | null> {
  try {
    const r = getRedis()
    const [countRaw, ethRaw, clawdRaw] = await r.mget<[number, number, number]>(
      RESCORE_COUNT_KEY,
      ETH_TOTAL_KEY,
      CLAWD_TOTAL_KEY,
    )
    const count = typeof countRaw === 'number' ? countRaw : 0
    const ethTotal = typeof ethRaw === 'number' ? ethRaw : 0
    const clawdTotal = typeof clawdRaw === 'number' ? clawdRaw : 0
    const clawdDisplay = await estimateClawdDisplayFromEth(r, ethTotal, clawdTotal)
    return { count, ethTotal, clawdTotal, clawdDisplay }
  } catch {
    return null
  }
}

export function formatClawdBurned(clawdTotal: number): string {
  return Math.round(clawdTotal).toLocaleString('en-US')
}
