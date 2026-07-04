import { Redis } from '@upstash/redis'
import { getRedis } from '@/lib/redis'
import { SCORE_PAYMENT_WEI, RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import { getClawdBurnedViaContract, getContractEthBalance } from '@/lib/clawdBurnIndex'

const RESCORE_COUNT_KEY = 'build-report:burns:rescore-count'
const ETH_TOTAL_KEY = 'build-report:burns:eth-total'

export const SCORE_PAYMENT_ETH = Number(SCORE_PAYMENT_WEI) / 1e18

export type RescoreBurnStats = {
  count: number
  ethContributed: number
  ethPendingInReceiver: number
  clawdBurnedOnChain: number
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
    const [countRaw, ethRaw, ethPending, clawdBurnedOnChain] = await Promise.all([
      r.get<number>(RESCORE_COUNT_KEY),
      r.get<number>(ETH_TOTAL_KEY),
      getContractEthBalance(RECEIVER_BUY_AND_BURN),
      getClawdBurnedViaContract(RECEIVER_BUY_AND_BURN),
    ])

    return {
      count: typeof countRaw === 'number' ? countRaw : 0,
      ethContributed: typeof ethRaw === 'number' ? ethRaw : 0,
      ethPendingInReceiver: ethPending,
      clawdBurnedOnChain,
    }
  } catch {
    return null
  }
}

/** @deprecated use formatClawdAmount from clawdBurnIndex */
export function formatClawdBurned(clawdTotal: number): string {
  return Math.round(clawdTotal).toLocaleString('en-US')
}
