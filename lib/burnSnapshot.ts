import { createPublicClient, defineChain, http } from 'viem'
import { getRedis } from '@/lib/redis'
import { BASE_CHAIN_ID, RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import { fetchOnChainBurnTotals, getContractEthBalance, clawdToDeadFromRpcLogs } from '@/lib/clawdBurnIndex'

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

function mergeClawdBurned(existing: number, scanned: number, scanOk: boolean): number {
  if (!scanOk) return existing
  return scanned >= existing ? scanned : existing
}

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
    clawdBurned: mergeClawdBurned(existing.clawdBurned, totals.clawdBurned, scanOk),
    // Successful scan is authoritative for lastBurnAt (monotonic merge could stick a bad/future date).
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

export type BurnRefreshResult = BurnSnapshot & {
  appliedFromTx: boolean
}

/** Fast path after execute() — parse receipt via RPC and bump cached totals. */
export async function refreshBurnAfterExecute(txHash: `0x${string}`): Promise<BurnRefreshResult> {
  const r = getRedis()
  const appliedKey = `${APPLIED_TX_PREFIX}${txHash.toLowerCase()}`
  const ethPendingInReceiver = await getContractEthBalance(RECEIVER_BUY_AND_BURN)
  await r.set(ETH_PENDING_KEY, ethPendingInReceiver)

  if (await r.get(appliedKey)) {
    const snapshot = await getBurnSnapshotForDisplay()
    return { ...snapshot, ethPendingInReceiver, appliedFromTx: true }
  }

  const client = createBaseClient()
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>> | null = null

  try {
    // Prefer receipt only — EIP-7702 / smart-wallet txs can make getTransaction().to flaky.
    receipt = await client.getTransactionReceipt({ hash: txHash })
  } catch {
    const snapshot = await getBurnSnapshotForDisplay()
    return { ...snapshot, ethPendingInReceiver, appliedFromTx: false }
  }

  if (
    !receipt ||
    receipt.status !== 'success' ||
    receipt.to?.toLowerCase() !== RECEIVER_BUY_AND_BURN.toLowerCase()
  ) {
    const snapshot = await getBurnSnapshotForDisplay()
    return { ...snapshot, ethPendingInReceiver, appliedFromTx: false }
  }

  const clawdFromTx = clawdToDeadFromRpcLogs(receipt.logs)
  if (clawdFromTx <= BigInt(0)) {
    const snapshot = await getBurnSnapshotForDisplay()
    return { ...snapshot, ethPendingInReceiver, appliedFromTx: false }
  }

  const existing = await getBurnSnapshotForDisplay()
  const clawdBurned = existing.clawdBurned + Number(clawdFromTx) / 1e18

  let lastBurnAt: string | null = null
  try {
    const block = await client.getBlock({ blockHash: receipt.blockHash })
    lastBurnAt = new Date(Number(block.timestamp) * 1000).toISOString()
  } catch {
    try {
      const block = await client.getBlock({ blockNumber: receipt.blockNumber })
      lastBurnAt = new Date(Number(block.timestamp) * 1000).toISOString()
    } catch {
      // Don't bump the amount while leaving a stale lastBurnAt — full resync instead.
      const synced = await syncBurnSnapshot()
      await r.set(appliedKey, 1, { ex: 60 * 60 * 24 * 30 })
      return { ...synced, ethPendingInReceiver, appliedFromTx: true }
    }
  }

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
  }
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
