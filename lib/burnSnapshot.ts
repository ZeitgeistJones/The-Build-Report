import { getRedis } from '@/lib/redis'
import { RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import { fetchOnChainBurnTotals } from '@/lib/clawdBurnIndex'

const CLAWD_BURNED_KEY = 'build-report:burns:hub:clawdBurned'
const LAST_BURN_AT_KEY = 'build-report:burns:hub:lastBurnAt'
const UPDATED_AT_KEY = 'build-report:burns:hub:updatedAt'
const LEGACY_ONCHAIN_CACHE_KEY = 'build-report:burns:onchain-cache'

export type BurnSnapshot = {
  clawdBurned: number
  lastBurnAt: string | null
  updatedAt: string | null
}

/** Slow path — Blockscout scan. Call from cron/admin only. */
export async function syncBurnSnapshot(): Promise<BurnSnapshot> {
  const totals = await fetchOnChainBurnTotals([RECEIVER_BUY_AND_BURN])
  const updatedAt = new Date().toISOString()
  const snapshot: BurnSnapshot = {
    clawdBurned: totals.clawdBurned,
    lastBurnAt: totals.lastBurnAt,
    updatedAt,
  }

  const r = getRedis()
  await Promise.all([
    r.set(CLAWD_BURNED_KEY, snapshot.clawdBurned),
    r.set(LAST_BURN_AT_KEY, snapshot.lastBurnAt),
    r.set(UPDATED_AT_KEY, snapshot.updatedAt),
  ])

  return snapshot
}

/** Fast path — KV read only. Never hits Blockscout. */
export async function getBurnSnapshotForDisplay(): Promise<BurnSnapshot> {
  try {
    const r = getRedis()
    const [clawdBurnedRaw, lastBurnAt, updatedAt] = await Promise.all([
      r.get<number>(CLAWD_BURNED_KEY),
      r.get<string | null>(LAST_BURN_AT_KEY),
      r.get<string | null>(UPDATED_AT_KEY),
    ])

    if (typeof clawdBurnedRaw === 'number') {
      return {
        clawdBurned: clawdBurnedRaw,
        lastBurnAt: lastBurnAt ?? null,
        updatedAt: updatedAt ?? null,
      }
    }

    const legacy = await r.get<{ clawdBurned: number; lastBurnAt: string | null }>(LEGACY_ONCHAIN_CACHE_KEY)
    if (legacy && typeof legacy.clawdBurned === 'number') {
      const migrated: BurnSnapshot = {
        clawdBurned: legacy.clawdBurned,
        lastBurnAt: legacy.lastBurnAt ?? null,
        updatedAt: new Date().toISOString(),
      }
      await Promise.all([
        r.set(CLAWD_BURNED_KEY, migrated.clawdBurned),
        r.set(LAST_BURN_AT_KEY, migrated.lastBurnAt),
        r.set(UPDATED_AT_KEY, migrated.updatedAt),
      ])
      return migrated
    }

    return { clawdBurned: 0, lastBurnAt: null, updatedAt: null }
  } catch {
    return { clawdBurned: 0, lastBurnAt: null, updatedAt: null }
  }
}

/** Fire-and-forget refresh after rescore — does not block the caller. */
export function scheduleBurnSnapshotSync(): void {
  void syncBurnSnapshot().catch(() => {})
}
