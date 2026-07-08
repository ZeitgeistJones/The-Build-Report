import { getRedis } from '@/lib/redis'
import { RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import { fetchOnChainBurnTotals, getContractEthBalance } from '@/lib/clawdBurnIndex'

const CLAWD_BURNED_KEY = 'build-report:burns:hub:clawdBurned'
const LAST_BURN_AT_KEY = 'build-report:burns:hub:lastBurnAt'
const UPDATED_AT_KEY = 'build-report:burns:hub:updatedAt'
const ETH_PENDING_KEY = 'build-report:burns:hub:ethPending'
const LEGACY_ONCHAIN_CACHE_KEY = 'build-report:burns:onchain-cache'

export type BurnSnapshot = {
  clawdBurned: number
  lastBurnAt: string | null
  updatedAt: string | null
  ethPendingInReceiver: number
}

/** Slow path — Blockscout scan. Call from cron/admin only. */
export async function syncBurnSnapshot(): Promise<BurnSnapshot> {
  const [totals, ethPending, existing] = await Promise.all([
    fetchOnChainBurnTotals([RECEIVER_BUY_AND_BURN]),
    getContractEthBalance(RECEIVER_BUY_AND_BURN),
    getBurnSnapshotForDisplay(),
  ])
  const updatedAt = new Date().toISOString()
  const scanOk = totals.ok
  const snapshot: BurnSnapshot = {
    clawdBurned: scanOk ? totals.clawdBurned : existing.clawdBurned,
    lastBurnAt: scanOk ? totals.lastBurnAt : existing.lastBurnAt,
    updatedAt: scanOk ? updatedAt : (existing.updatedAt ?? updatedAt),
    ethPendingInReceiver: ethPending,
  }

  const r = getRedis()
  const writes: Promise<unknown>[] = [
    r.set(ETH_PENDING_KEY, snapshot.ethPendingInReceiver),
  ]
  if (scanOk) {
    writes.push(
      r.set(CLAWD_BURNED_KEY, snapshot.clawdBurned),
      r.set(LAST_BURN_AT_KEY, snapshot.lastBurnAt),
      r.set(UPDATED_AT_KEY, snapshot.updatedAt),
    )
  }

  await Promise.all(writes)

  return snapshot
}

/** Fast path — KV read only. Never hits Blockscout. */
export async function getBurnSnapshotForDisplay(): Promise<BurnSnapshot> {
  try {
    const r = getRedis()
    const [clawdBurnedRaw, lastBurnAt, updatedAt, ethPendingRaw] = await Promise.all([
      r.get<number>(CLAWD_BURNED_KEY),
      r.get<string | null>(LAST_BURN_AT_KEY),
      r.get<string | null>(UPDATED_AT_KEY),
      r.get<number>(ETH_PENDING_KEY),
    ])

    if (typeof clawdBurnedRaw === 'number') {
      return {
        clawdBurned: clawdBurnedRaw,
        lastBurnAt: lastBurnAt ?? null,
        updatedAt: updatedAt ?? null,
        ethPendingInReceiver: typeof ethPendingRaw === 'number' ? ethPendingRaw : 0,
      }
    }

    const legacy = await r.get<{ clawdBurned: number; lastBurnAt: string | null }>(LEGACY_ONCHAIN_CACHE_KEY)
    if (legacy && typeof legacy.clawdBurned === 'number') {
      const migrated: BurnSnapshot = {
        clawdBurned: legacy.clawdBurned,
        lastBurnAt: legacy.lastBurnAt ?? null,
        updatedAt: new Date().toISOString(),
        ethPendingInReceiver: typeof ethPendingRaw === 'number' ? ethPendingRaw : 0,
      }
      await Promise.all([
        r.set(CLAWD_BURNED_KEY, migrated.clawdBurned),
        r.set(LAST_BURN_AT_KEY, migrated.lastBurnAt),
        r.set(UPDATED_AT_KEY, migrated.updatedAt),
      ])
      return migrated
    }

    return { clawdBurned: 0, lastBurnAt: null, updatedAt: null, ethPendingInReceiver: 0 }
  } catch {
    return { clawdBurned: 0, lastBurnAt: null, updatedAt: null, ethPendingInReceiver: 0 }
  }
}

/** Fire-and-forget refresh after rescore — does not block the caller. */
export function scheduleBurnSnapshotSync(): void {
  void syncBurnSnapshot().catch(() => {})
}

/** Optimistic bump until the next on-chain sync overwrites ETH_PENDING_KEY. */
export async function incrementEthPendingOptimistic(ethAmount: number): Promise<void> {
  if (ethAmount <= 0) return
  try {
    const r = getRedis()
    await r.incrbyfloat(ETH_PENDING_KEY, ethAmount)
  } catch {
    // non-blocking — live balance read on display is authoritative
  }
}
