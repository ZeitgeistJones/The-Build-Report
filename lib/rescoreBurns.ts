import { Redis } from '@upstash/redis'
import { getRedis } from '@/lib/redis'
import { SCORE_PAYMENT_WEI, RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import { getContractEthBalance } from '@/lib/clawdBurnIndex'
import {
  getBurnSnapshotLiveMerged,
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

/** Promo path already tracks ETH pending separately — only bump the funded-rescore counter. */
export async function recordRescoreFundedCount(redisClient: Redis): Promise<void> {
  await redisClient.incr(RESCORE_COUNT_KEY)
}

export async function getRescoreBurnStats(): Promise<RescoreBurnStats | null> {
  try {
    const r = getRedis()
    const [countRaw, ethRaw, snapshot, ethPending] = await Promise.all([
      r.get<number | string>(RESCORE_COUNT_KEY),
      r.get<number | string>(ETH_TOTAL_KEY),
      getBurnSnapshotLiveMerged(),
      getContractEthBalance(RECEIVER_BUY_AND_BURN),
    ])

    const count = typeof countRaw === 'number' ? countRaw : Number(countRaw)
    const ethContributed = typeof ethRaw === 'number' ? ethRaw : Number(ethRaw)

    return {
      count: Number.isFinite(count) ? count : 0,
      ethContributed: Number.isFinite(ethContributed) ? ethContributed : 0,
      // Live ETH balance is authoritative; snapshot merge may be slightly stale on write-back.
      ethPendingInReceiver: ethPending,
      clawdBurnedOnChain: snapshot.clawdBurned,
      lastBurnAt: snapshot.lastBurnAt,
    }
  } catch {
    return null
  }
}
