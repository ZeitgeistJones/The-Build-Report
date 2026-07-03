import { Redis } from '@upstash/redis'
import { getEthAndClawdUsdPrices } from '@/lib/coingecko'
import { SCORE_PAYMENT_WEI } from '@/lib/web3/constants'

const RESCORE_COUNT_KEY = 'build-report:burns:rescore-count'
const ETH_TOTAL_KEY = 'build-report:burns:eth-total'
const CLAWD_TOTAL_KEY = 'build-report:burns:clawd-total'

export const SCORE_PAYMENT_ETH = Number(SCORE_PAYMENT_WEI) / 1e18

let redis: Redis | null = null

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
}

export type RescoreBurnStats = {
  count: number
  ethTotal: number
  clawdTotal: number
}

async function estimateClawdBurnedThisRescore(): Promise<number | null> {
  try {
    const { ethUsd, clawdUsd } = await getEthAndClawdUsdPrices()
    const usdValue = SCORE_PAYMENT_ETH * ethUsd
    return usdValue / clawdUsd
  } catch (err) {
    console.warn('[rescoreBurns] CoinGecko price fetch failed, skipping CLAWD increment:', err)
    return null
  }
}

export async function recordRescoreBurn(redisClient: Redis): Promise<void> {
  const clawdBurned = await estimateClawdBurnedThisRescore()

  const ops: Promise<unknown>[] = [
    redisClient.incr(RESCORE_COUNT_KEY),
    redisClient.incrbyfloat(ETH_TOTAL_KEY, SCORE_PAYMENT_ETH),
  ]

  if (clawdBurned != null && clawdBurned > 0) {
    ops.push(redisClient.incrbyfloat(CLAWD_TOTAL_KEY, clawdBurned))
  }

  await Promise.all(ops)
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
    return { count, ethTotal, clawdTotal }
  } catch {
    return null
  }
}

export function formatClawdBurned(clawdTotal: number): string {
  return Math.round(clawdTotal).toLocaleString('en-US')
}
