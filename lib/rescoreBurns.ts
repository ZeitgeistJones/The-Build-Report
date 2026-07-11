import { Redis } from '@upstash/redis'
import { getRedis } from '@/lib/redis'
import { SCORE_PAYMENT_WEI, RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import { getContractEthBalance } from '@/lib/clawdBurnIndex'
import {
  getBurnSnapshotForDisplay,
  incrementEthPendingOptimistic,
  scheduleBurnSnapshotSync,
} from '@/lib/burnSnapshot'

const RESCORE_COUNT_KEY = 'build-report:burns:rescore-count'
const ETH_TOTAL_KEY = 'build-report:burns:eth-total'

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
    incrementEthPendingOptimistic(SCORE_PAYMENT_ETH),
  ])
  scheduleBurnSnapshotSync()
}

export async function getRescoreBurnStats(): Promise<RescoreBurnStats | null> {
  try {
    const r = getRedis()
    const [countRaw, ethRaw, snapshot, ethPending] = await Promise.all([
      r.get<number>(RESCORE_COUNT_KEY),
      r.get<number>(ETH_TOTAL_KEY),
      getBurnSnapshotForDisplay(),
      getContractEthBalance(RECEIVER_BUY_AND_BURN),
    ])

    // #region agent log
    console.log('[rescore-count-debug]', JSON.stringify({
      hypothesisId: 'E',
      countRaw,
      countRawType: typeof countRaw,
      parsedAsNumberOnly: typeof countRaw === 'number' ? countRaw : 0,
    }))
    // #endregion

    return {
      count: typeof countRaw === 'number' ? countRaw : 0,
      ethContributed: typeof ethRaw === 'number' ? ethRaw : 0,
      ethPendingInReceiver: ethPending,
      clawdBurnedOnChain: snapshot.clawdBurned,
      lastBurnAt: snapshot.lastBurnAt,
    }
  } catch {
    return null
  }
}
