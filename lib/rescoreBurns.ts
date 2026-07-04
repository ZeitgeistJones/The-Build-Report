import { Redis } from '@upstash/redis'
import { getRedis } from '@/lib/redis'
import { SCORE_PAYMENT_WEI, RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import {
  fetchOnChainBurnTotals,
  getContractEthBalance,
  type OnChainBurnTotals,
} from '@/lib/clawdBurnIndex'

const RESCORE_COUNT_KEY = 'build-report:burns:rescore-count'
const ETH_TOTAL_KEY = 'build-report:burns:eth-total'
const ONCHAIN_BURN_CACHE_KEY = 'build-report:burns:onchain-cache'
const ONCHAIN_BURN_CACHE_TTL_SEC = 300

export const SCORE_PAYMENT_ETH = Number(SCORE_PAYMENT_WEI) / 1e18

export type RescoreBurnStats = {
  count: number
  ethContributed: number
  ethPendingInReceiver: number
  clawdBurnedOnChain: number
  lastBurnAt: string | null
}

export async function recordRescoreBurn(redisClient: Redis): Promise<void> {
  await Promise.all([
    redisClient.incr(RESCORE_COUNT_KEY),
    redisClient.incrbyfloat(ETH_TOTAL_KEY, SCORE_PAYMENT_ETH),
  ])
}

async function getCachedOnChainBurns(redis: Redis): Promise<OnChainBurnTotals> {
  const cached = await redis.get<OnChainBurnTotals>(ONCHAIN_BURN_CACHE_KEY)
  if (cached && typeof cached.clawdBurned === 'number') return cached

  const fresh = await fetchOnChainBurnTotals([RECEIVER_BUY_AND_BURN])
  await redis.set(ONCHAIN_BURN_CACHE_KEY, fresh, { ex: ONCHAIN_BURN_CACHE_TTL_SEC })
  return fresh
}

export async function getRescoreBurnStats(): Promise<RescoreBurnStats | null> {
  try {
    const r = getRedis()
    const [countRaw, ethRaw, ethPending, onChain] = await Promise.all([
      r.get<number>(RESCORE_COUNT_KEY),
      r.get<number>(ETH_TOTAL_KEY),
      getContractEthBalance(RECEIVER_BUY_AND_BURN),
      getCachedOnChainBurns(r),
    ])

    return {
      count: typeof countRaw === 'number' ? countRaw : 0,
      ethContributed: typeof ethRaw === 'number' ? ethRaw : 0,
      ethPendingInReceiver: ethPending,
      clawdBurnedOnChain: onChain.clawdBurned,
      lastBurnAt: onChain.lastBurnAt,
    }
  } catch {
    return null
  }
}
