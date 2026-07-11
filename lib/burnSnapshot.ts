import { createPublicClient, defineChain, http } from 'viem'
import { getRedis } from '@/lib/redis'
import { BASE_CHAIN_ID, RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import {
  fetchOnChainBurnTotals,
  getContractEthBalance,
  clawdBurnedFromExecuteReceipt,
  type OnChainBurnTotals,
} from '@/lib/clawdBurnIndex'

const base = defineChain({
  id: BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
})

function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org', { timeout: 15_000 }),
  })
}

const CLAWD_BURNED_KEY = 'build-report:burns:hub:clawdBurned'
const LAST_BURN_AT_KEY = 'build-report:burns:hub:lastBurnAt'
const UPDATED_AT_KEY = 'build-report:burns:hub:updatedAt'
const ETH_PENDING_KEY = 'build-report:burns:hub:ethPending'
const APPLIED_TX_PREFIX = 'build-report:burns:applied-tx:'
const LEGACY_ONCHAIN_CACHE_KEY = 'build-report:burns:onchain-cache'
const SYNC_LOCK_KEY = 'build-report:burns:hub:sync-lock'

function mergeClawdBurned(existing: number, scanned: number, scanOk: boolean): number {
  if (!scanOk) return existing
  return scanned >= existing ? scanned : existing
}

function mergeLastBurnAt(
  existing: string | null,
  scanned: string | null,
  scanOk: boolean,
): string | null {
  if (!scanOk) return existing
  if (!scanned) return existing
  if (!existing) return scanned
  return scanned >= existing ? scanned : existing
}

function parseRedisNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export type BurnSnapshot = {
  clawdBurned: number
  lastBurnAt: string | null
  updatedAt: string | null
  ethPendingInReceiver: number
}

export type BurnSyncResult = BurnSnapshot & {
  scanOk: boolean
}

/** Authoritative on-chain resync (RPC Burned events, Blockscout fallback). */
export async function syncBurnSnapshot(): Promise<BurnSyncResult> {
  const [totals, ethPending, existing] = await Promise.all([
    fetchOnChainBurnTotals([RECEIVER_BUY_AND_BURN]),
    getContractEthBalance(RECEIVER_BUY_AND_BURN),
    getBurnSnapshotForDisplay(),
  ])
  const updatedAt = new Date().toISOString()
  const scanOk = totals.ok
  const snapshot: BurnSnapshot = {
    clawdBurned: mergeClawdBurned(existing.clawdBurned, totals.clawdBurned, scanOk),
    lastBurnAt: mergeLastBurnAt(existing.lastBurnAt, totals.lastBurnAt, scanOk),
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

  return { ...snapshot, scanOk }
}

export type BurnRefreshResult = BurnSnapshot & {
  appliedFromTx: boolean
  scanOk?: boolean
}

/** Fast path after execute() — receipt amount + chain index; never leave totals stale. */
export async function refreshBurnAfterExecute(txHash: `0x${string}`): Promise<BurnRefreshResult> {
  const r = getRedis()
  const appliedKey = `${APPLIED_TX_PREFIX}${txHash.toLowerCase()}`
  const ethPendingInReceiver = await getContractEthBalance(RECEIVER_BUY_AND_BURN)
  await r.set(ETH_PENDING_KEY, ethPendingInReceiver)

  // Already applied — still re-sync from chain so amount/time cannot stay stale.
  if (await r.get(appliedKey)) {
    const synced = await syncBurnSnapshot()
    return { ...synced, ethPendingInReceiver: synced.ethPendingInReceiver, appliedFromTx: synced.scanOk }
  }

  const client = createBaseClient()
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>> | null = null

  try {
    receipt = await client.getTransactionReceipt({ hash: txHash })
  } catch {
    const synced = await syncBurnSnapshot()
    return { ...synced, appliedFromTx: false }
  }

  if (
    !receipt ||
    receipt.status !== 'success' ||
    receipt.to?.toLowerCase() !== RECEIVER_BUY_AND_BURN.toLowerCase()
  ) {
    const synced = await syncBurnSnapshot()
    return { ...synced, appliedFromTx: false }
  }

  const clawdFromTx = clawdBurnedFromExecuteReceipt(receipt.logs)
  const pre = await getBurnSnapshotForDisplay()
  const synced = await syncBurnSnapshot()

  let lastBurnAtFromTx: string | null = null
  try {
    const block = await client.getBlock({ blockHash: receipt.blockHash })
    lastBurnAtFromTx = new Date(Number(block.timestamp) * 1000).toISOString()
  } catch {
    try {
      const block = await client.getBlock({ blockNumber: receipt.blockNumber })
      lastBurnAtFromTx = new Date(Number(block.timestamp) * 1000).toISOString()
    } catch {
      lastBurnAtFromTx = null
    }
  }

  if (clawdFromTx <= BigInt(0) && !synced.scanOk) {
    return { ...synced, ethPendingInReceiver, appliedFromTx: false }
  }

  // Absolute index when caught up; otherwise floor at pre+tx so a mid-backfill sync
  // cannot claim success while leaving this execute off the displayed total.
  const fromReceipt =
    clawdFromTx > BigInt(0) ? pre.clawdBurned + Number(clawdFromTx) / 1e18 : pre.clawdBurned
  const clawdBurned = Math.max(synced.clawdBurned, fromReceipt)
  const lastBurnAt = mergeLastBurnAt(
    mergeLastBurnAt(pre.lastBurnAt, synced.lastBurnAt, synced.scanOk),
    lastBurnAtFromTx,
    Boolean(lastBurnAtFromTx),
  )
  const updatedAt = new Date().toISOString()

  await Promise.all([
    r.set(CLAWD_BURNED_KEY, clawdBurned),
    r.set(LAST_BURN_AT_KEY, lastBurnAt),
    r.set(UPDATED_AT_KEY, updatedAt),
    r.set(appliedKey, 1, { ex: 60 * 60 * 24 * 30 }),
    r.set(ETH_PENDING_KEY, ethPendingInReceiver),
  ])

  return {
    clawdBurned,
    lastBurnAt,
    updatedAt,
    ethPendingInReceiver,
    appliedFromTx: true,
    scanOk: synced.scanOk,
  }
}

/** Fast path — KV read only. */
export async function getBurnSnapshotForDisplay(): Promise<BurnSnapshot> {
  try {
    const r = getRedis()
    const [clawdBurnedRaw, lastBurnAt, updatedAt, ethPendingRaw] = await Promise.all([
      r.get<number | string>(CLAWD_BURNED_KEY),
      r.get<string | null>(LAST_BURN_AT_KEY),
      r.get<string | null>(UPDATED_AT_KEY),
      r.get<number | string>(ETH_PENDING_KEY),
    ])

    const clawdBurned = parseRedisNumber(clawdBurnedRaw)
    if (clawdBurned != null) {
      return {
        clawdBurned,
        lastBurnAt: lastBurnAt ?? null,
        updatedAt: updatedAt ?? null,
        ethPendingInReceiver: parseRedisNumber(ethPendingRaw) ?? 0,
      }
    }

    const legacy = await r.get<{ clawdBurned: number; lastBurnAt: string | null }>(LEGACY_ONCHAIN_CACHE_KEY)
    if (legacy && typeof legacy.clawdBurned === 'number') {
      const migrated: BurnSnapshot = {
        clawdBurned: legacy.clawdBurned,
        lastBurnAt: legacy.lastBurnAt ?? null,
        updatedAt: new Date().toISOString(),
        ethPendingInReceiver: parseRedisNumber(ethPendingRaw) ?? 0,
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

/**
 * Display totals: live RPC index when available, Redis otherwise.
 * Write-back keeps Redis from drifting after executes the client refresh missed.
 */
export async function getBurnSnapshotLiveMerged(): Promise<BurnSnapshot> {
  const [cached, ethPending, live] = await Promise.all([
    getBurnSnapshotForDisplay(),
    getContractEthBalance(RECEIVER_BUY_AND_BURN),
    fetchOnChainBurnTotals([RECEIVER_BUY_AND_BURN], { mode: 'display' }).catch(
      (): OnChainBurnTotals => ({
        clawdBurned: 0,
        lastBurnAt: null,
        ok: false,
        caughtUp: false,
      }),
    ),
  ])

  if (!live.ok || live.caughtUp === false) {
    scheduleBurnSnapshotSync()
  }

  if (!live.ok) {
    return { ...cached, ethPendingInReceiver: ethPending }
  }

  const clawdBurned = Math.max(cached.clawdBurned, live.clawdBurned)
  const lastBurnAt = mergeLastBurnAt(cached.lastBurnAt, live.lastBurnAt, true)
  const updatedAt = new Date().toISOString()
  const merged: BurnSnapshot = {
    clawdBurned,
    lastBurnAt,
    updatedAt,
    ethPendingInReceiver: ethPending,
  }

  const drifted =
    clawdBurned > cached.clawdBurned + 1e-9 ||
    (lastBurnAt != null && lastBurnAt !== cached.lastBurnAt)

  if (drifted) {
    const r = getRedis()
    void Promise.all([
      r.set(CLAWD_BURNED_KEY, clawdBurned),
      r.set(LAST_BURN_AT_KEY, lastBurnAt),
      r.set(UPDATED_AT_KEY, updatedAt),
      r.set(ETH_PENDING_KEY, ethPending),
    ]).catch(() => {})
  }

  return merged
}

/** Fire-and-forget refresh — locked so homepage traffic cannot stampede RPC backfill. */
export function scheduleBurnSnapshotSync(): void {
  void (async () => {
    try {
      const r = getRedis()
      const got = await r.set(SYNC_LOCK_KEY, 1, { nx: true, ex: 90 })
      if (!got) return
      await syncBurnSnapshot()
    } catch {
      // non-blocking
    }
  })()
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
