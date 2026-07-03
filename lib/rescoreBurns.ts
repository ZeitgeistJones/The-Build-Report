import { Redis } from '@upstash/redis'
import { SCORE_PAYMENT_WEI } from '@/lib/web3/constants'

const RESCORE_COUNT_KEY = 'build-report:burns:rescore-count'
const ETH_TOTAL_KEY = 'build-report:burns:eth-total'

const SCORE_PAYMENT_ETH = Number(SCORE_PAYMENT_WEI) / 1e18

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
}

export async function recordRescoreBurn(redisClient: Redis): Promise<void> {
  await Promise.all([
    redisClient.incr(RESCORE_COUNT_KEY),
    redisClient.incrbyfloat(ETH_TOTAL_KEY, SCORE_PAYMENT_ETH),
  ])
}

export async function getRescoreBurnStats(): Promise<RescoreBurnStats | null> {
  try {
    const r = getRedis()
    const [countRaw, ethRaw] = await r.mget<[number, number]>(RESCORE_COUNT_KEY, ETH_TOTAL_KEY)
    const count = typeof countRaw === 'number' ? countRaw : 0
    const ethTotal = typeof ethRaw === 'number' ? ethRaw : 0
    return { count, ethTotal }
  } catch {
    return null
  }
}

export function formatBurnedEth(ethTotal: number): string {
  if (ethTotal === 0) return '0'
  return ethTotal.toFixed(6).replace(/\.?0+$/, '')
}
