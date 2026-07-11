import {
  createPublicClient,
  defineChain,
  fallback,
  http,
  parseAbiItem,
  type Log,
} from 'viem'
import { getRedis } from '@/lib/redis'
import {
  BASE_CHAIN_ID,
  CLAWD_TOKEN_ADDRESS,
  RECEIVER_BUY_AND_BURN,
  RECEIVER_BUY_AND_BURN_FROM_BLOCK,
} from '@/lib/web3/constants'

const base = defineChain({
  id: BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
})

const BLOCKSCOUT_V2 = 'https://base.blockscout.com/api/v2'
const DEAD_TOPIC =
  '0x000000000000000000000000000000000000000000000000000000000000dead'
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const EXECUTE_METHOD_ID = '61461954'
const MAX_TX_PAGES = 10
const FETCH_TIMEOUT_MS = 8_000
const BURN_INDEX_BUDGET_MS = 45_000
/** Base public RPC: eth_getLogs limited to 10_000-block ranges. */
const LOG_CHUNK_BLOCKS = BigInt(9_000)
/** Homepage path — keep catch-up short; cron/sync finishes backfill. */
const DISPLAY_MAX_CHUNKS = 6
const BURN_RPC_INDEX_KEY = 'build-report:burns:hub:rpc-index'
const LOG_RETRY_MAX = 6
const LOG_CHUNK_PAUSE_MS = 75

const BURNED_EVENT = parseAbiItem('event Burned(uint256 amount)')

export type OnChainBurnTotals = {
  clawdBurned: number
  /** ISO timestamp of the most recent matching burn */
  lastBurnAt: string | null
  /** False when indexing failed — callers must not treat totals as authoritative. */
  ok: boolean
  /** True when the RPC index has scanned through the latest block. */
  caughtUp?: boolean
}

type BurnRpcIndex = {
  clawdBurnedWei: string
  lastBurnAt: string | null
  throughBlock: string
}

export type FetchBurnTotalsOptions = {
  /**
   * `sync` — backfill as far as the budget allows (cron / execute refresh).
   * `display` — incremental only, capped chunks (homepage).
   */
  mode?: 'sync' | 'display'
}

interface AddressTxItem {
  hash: string
  timestamp?: string
  status?: string
  method?: string | null
  raw_input?: string
  result?: string
}

interface AddressTxPage {
  items?: AddressTxItem[]
  next_page_params?: Record<string, unknown> | null
}

interface TxLogItem {
  timestamp?: string
  address?: { hash?: string }
  topics?: string[]
  data?: string
  total?: { value?: string }
  decoded?: {
    method_call?: string
    parameters?: { name?: string; value?: string }[]
  }
}

interface TxLogsPage {
  items?: TxLogItem[]
}

function rpcUrls(): string[] {
  return [
    process.env.BASE_RPC_URL,
    process.env.NEXT_PUBLIC_BASE_RPC_URL,
    'https://mainnet.base.org',
  ].filter((u): u is string => Boolean(u && u.trim()))
}

function createBaseClient() {
  const urls = rpcUrls()
  const httpOpts = { timeout: 20_000 }
  const transport =
    urls.length <= 1
      ? http(urls[0] ?? 'https://mainnet.base.org', httpOpts)
      : fallback(urls.map(url => http(url, httpOpts)))
  return createPublicClient({ chain: base, transport })
}

function addressTxUrl(contract: string, cursor?: Record<string, unknown>): string {
  const url = new URL(`${BLOCKSCOUT_V2}/addresses/${contract}/transactions`)
  if (cursor) {
    for (const [key, value] of Object.entries(cursor)) {
      if (value != null) url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function fetchBlockscout<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function isExecuteTx(tx: AddressTxItem): boolean {
  if (tx.result && tx.result !== 'success' && tx.status && tx.status !== 'ok') return false
  if (tx.method === 'execute') return true
  const input = tx.raw_input?.toLowerCase().replace(/^0x/, '') ?? ''
  return input.startsWith(EXECUTE_METHOD_ID)
}

function clawdToDeadInLogs(logs: TxLogItem[]): bigint {
  const clawd = CLAWD_TOKEN_ADDRESS.toLowerCase()
  let total = BigInt(0)

  for (const log of logs) {
    if (log.address?.hash?.toLowerCase() !== clawd) continue
    if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) continue
    if (log.topics?.[2]?.toLowerCase() !== DEAD_TOPIC) continue

    const fromDecoded = log.decoded?.parameters?.find(p => p.name === 'value')?.value
    const raw = fromDecoded ?? log.total?.value ?? log.data
    if (!raw) continue
    try {
      total += BigInt(raw)
    } catch {
      // skip malformed values
    }
  }

  return total
}

/** Sum CLAWD→dead Transfer logs from an RPC tx receipt (viem format). */
export function clawdToDeadFromRpcLogs(
  logs: { address: string; topics: readonly string[]; data: string }[],
): bigint {
  const clawd = CLAWD_TOKEN_ADDRESS.toLowerCase()
  let total = BigInt(0)

  for (const log of logs) {
    if (log.address.toLowerCase() !== clawd) continue
    if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue
    if (log.topics[2]?.toLowerCase() !== DEAD_TOPIC) continue
    try {
      total += BigInt(log.data)
    } catch {
      // skip malformed values
    }
  }

  return total
}

/** CLAWD amount from receiver Burned(uint256) logs on an execute receipt. */
export function clawdBurnedFromReceiverLogs(
  logs: { address: string; topics: readonly string[]; data: string }[],
  receiver: string = RECEIVER_BUY_AND_BURN,
): bigint {
  const recv = receiver.toLowerCase()
  let total = BigInt(0)
  for (const log of logs) {
    if (log.address.toLowerCase() !== recv) continue
    // Burned(uint256) — topic0 = keccak256("Burned(uint256)")
    if (!log.topics[0]?.toLowerCase().startsWith('0xd83c6319')) continue
    try {
      total += BigInt(log.data)
    } catch {
      // skip
    }
  }
  return total
}

/** Amount burned in one execute receipt — prefer Burned event, fall back to CLAWD→dead Transfer. */
export function clawdBurnedFromExecuteReceipt(
  logs: { address: string; topics: readonly string[]; data: string }[],
): bigint {
  const fromEvent = clawdBurnedFromReceiverLogs(logs)
  if (fromEvent > BigInt(0)) return fromEvent
  return clawdToDeadFromRpcLogs(logs)
}

async function loadRpcIndex(): Promise<BurnRpcIndex | null> {
  try {
    const raw = await getRedis().get<BurnRpcIndex>(BURN_RPC_INDEX_KEY)
    if (
      raw &&
      typeof raw.clawdBurnedWei === 'string' &&
      typeof raw.throughBlock === 'string'
    ) {
      return raw
    }
    return null
  } catch {
    return null
  }
}

async function saveRpcIndex(index: BurnRpcIndex): Promise<void> {
  await getRedis().set(BURN_RPC_INDEX_KEY, index)
}

function reduceBurnedLogs(
  logs: Log<bigint, number, false, typeof BURNED_EVENT>[],
  total: bigint,
): { total: bigint; lastBlock: bigint | null } {
  let lastBlock: bigint | null = null
  let next = total
  for (const log of logs) {
    const amount = log.args?.amount
    if (typeof amount !== 'bigint' || amount <= BigInt(0)) continue
    next += amount
    if (log.blockNumber != null && (lastBlock === null || log.blockNumber > lastBlock)) {
      lastBlock = log.blockNumber
    }
  }
  return { total: next, lastBlock }
}

async function timestampForBlock(
  client: ReturnType<typeof createBaseClient>,
  blockNumber: bigint,
): Promise<string | null> {
  try {
    const block = await client.getBlock({ blockNumber })
    return new Date(Number(block.timestamp) * 1000).toISOString()
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRateLimitedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /rate limit|429|too many requests|-32016/i.test(msg)
}

async function getBurnedLogsChunk(
  client: ReturnType<typeof createBaseClient>,
  receiver: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<Log<bigint, number, false, typeof BURNED_EVENT>[]> {
  let lastErr: unknown
  for (let attempt = 0; attempt < LOG_RETRY_MAX; attempt++) {
    try {
      return await client.getLogs({
        address: receiver,
        event: BURNED_EVENT,
        fromBlock,
        toBlock,
      })
    } catch (err) {
      lastErr = err
      if (!isRateLimitedError(err) && attempt >= 2) break
      await sleep(200 * 2 ** attempt + LOG_CHUNK_PAUSE_MS)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/**
 * Incremental RPC index of receiver Burned(uint256) events.
 * Progress is checkpointed in Redis so cron/sync can finish a cold backfill across runs.
 */
async function fetchBurnTotalsViaRpc(
  receiver: `0x${string}`,
  mode: 'sync' | 'display',
): Promise<OnChainBurnTotals> {
  const client = createBaseClient()
  const latest = await client.getBlockNumber()
  const prev = await loadRpcIndex()

  let total = prev ? BigInt(prev.clawdBurnedWei) : BigInt(0)
  let lastBurnAt = prev?.lastBurnAt ?? null
  let from = prev ? BigInt(prev.throughBlock) + BigInt(1) : RECEIVER_BUY_AND_BURN_FROM_BLOCK
  if (from > latest) {
    return { clawdBurned: Number(total) / 1e18, lastBurnAt, ok: true, caughtUp: true }
  }

  // Display path with no index yet: don't start a multi-minute backfill on the homepage.
  if (mode === 'display' && !prev) {
    return { clawdBurned: 0, lastBurnAt: null, ok: false, caughtUp: false }
  }

  const maxChunks = mode === 'display' ? DISPLAY_MAX_CHUNKS : Number.POSITIVE_INFINITY
  let chunks = 0
  let through = from - BigInt(1)
  let newestInPass: bigint | null = null

  for (let start = from; start <= latest && chunks < maxChunks; start += LOG_CHUNK_BLOCKS) {
    const end =
      start + LOG_CHUNK_BLOCKS - BigInt(1) > latest ? latest : start + LOG_CHUNK_BLOCKS - BigInt(1)
    const chunk = await getBurnedLogsChunk(client, receiver, start, end)
    const reduced = reduceBurnedLogs(chunk, total)
    total = reduced.total
    if (reduced.lastBlock != null) newestInPass = reduced.lastBlock
    through = end
    chunks += 1
    await saveRpcIndex({
      clawdBurnedWei: total.toString(),
      lastBurnAt,
      throughBlock: through.toString(),
    })
    if (start + LOG_CHUNK_BLOCKS <= latest && chunks < maxChunks) {
      await sleep(LOG_CHUNK_PAUSE_MS)
    }
  }

  if (newestInPass != null) {
    const ts = await timestampForBlock(client, newestInPass)
    if (ts && (!lastBurnAt || ts > lastBurnAt)) lastBurnAt = ts
    await saveRpcIndex({
      clawdBurnedWei: total.toString(),
      lastBurnAt,
      throughBlock: through.toString(),
    })
  }

  // ok = RPC scan ran; callers Math.max with Redis so partial cold backfill cannot lower totals.
  return {
    clawdBurned: Number(total) / 1e18,
    lastBurnAt,
    ok: true,
    caughtUp: through >= latest,
  }
}

async function fetchBurnTotalsViaBlockscout(contract: string): Promise<OnChainBurnTotals> {
  let total = BigInt(0)
  let lastBurnAt: string | null = null
  let cursor: Record<string, unknown> | null | undefined = undefined
  let pages = 0

  while (pages < MAX_TX_PAGES) {
    const page: AddressTxPage | null = await fetchBlockscout<AddressTxPage>(
      addressTxUrl(contract, cursor ?? undefined),
    )
    if (!page?.items?.length) break

    const executeTxs = page.items.filter(isExecuteTx)
    const burnedPerTx = await Promise.all(
      executeTxs.map(async tx => {
        const logsPage = await fetchBlockscout<TxLogsPage>(
          `${BLOCKSCOUT_V2}/transactions/${tx.hash}/logs`,
        )
        if (!logsPage?.items?.length) return { burned: BigInt(0), ts: null as string | null }
        const burned = clawdToDeadInLogs(logsPage.items)
        return { burned, ts: burned > BigInt(0) ? (tx.timestamp ?? null) : null }
      }),
    )
    for (const { burned, ts } of burnedPerTx) {
      total += burned
      if (ts && (!lastBurnAt || ts > lastBurnAt)) lastBurnAt = ts
    }

    pages += 1
    cursor = page.next_page_params ?? null
    if (!cursor) break
  }

  return { clawdBurned: Number(total) / 1e18, lastBurnAt, ok: true, caughtUp: true }
}

/**
 * Lifetime CLAWD burned via receiver execute() — primary index is on-chain Burned events
 * (RPC getLogs, Redis-checkpointed). Blockscout is fallback only.
 */
export async function fetchOnChainBurnTotals(
  attributedContracts: string[],
  options: FetchBurnTotalsOptions = {},
): Promise<OnChainBurnTotals> {
  const mode = options.mode ?? 'sync'
  const receiver = (attributedContracts[0] ?? RECEIVER_BUY_AND_BURN) as `0x${string}`

  try {
    const rpc = await Promise.race([
      fetchBurnTotalsViaRpc(receiver, mode),
      new Promise<OnChainBurnTotals>((_, reject) => {
        setTimeout(() => reject(new Error('burn rpc index timeout')), BURN_INDEX_BUDGET_MS)
      }),
    ])
    if (rpc.ok) return rpc
  } catch {
    // fall through — display uses checkpoint; sync may try Blockscout
  }

  if (mode === 'display') {
    // Homepage must stay fast; unfinished RPC backfill is cron's job.
    const partial = await loadRpcIndex()
    if (partial) {
      return {
        clawdBurned: Number(BigInt(partial.clawdBurnedWei)) / 1e18,
        lastBurnAt: partial.lastBurnAt,
        ok: true,
        // Unknown without a tip check — treat as not caught up so cron keeps advancing.
        caughtUp: false,
      }
    }
    // Cold display: Blockscout can unstick Redis while RPC index backfills.
    try {
      const bs = await fetchBurnTotalsViaBlockscout(receiver)
      if (bs.ok && bs.clawdBurned > 0) return { ...bs, caughtUp: false }
    } catch {
      // ignore
    }
    return { clawdBurned: 0, lastBurnAt: null, ok: false, caughtUp: false }
  }

  try {
    return await Promise.race([
      fetchBurnTotalsViaBlockscout(receiver),
      new Promise<OnChainBurnTotals>((_, reject) => {
        setTimeout(() => reject(new Error('burn blockscout index timeout')), BURN_INDEX_BUDGET_MS)
      }),
    ])
  } catch {
    return { clawdBurned: 0, lastBurnAt: null, ok: false }
  }
}

/** Lifetime CLAWD burned via txs to this receiver contract. */
export async function getClawdBurnedViaContract(contract: string): Promise<number> {
  const { clawdBurned } = await fetchOnChainBurnTotals([contract], { mode: 'sync' })
  return clawdBurned
}

export async function getContractEthBalance(contract: string): Promise<number> {
  try {
    const client = createBaseClient()
    const wei = await client.getBalance({ address: contract as `0x${string}` })
    return Number(wei) / 1e18
  } catch {
    return 0
  }
}

/** Compact display — e.g. 56.1K, 1.2M */
export function formatClawdCompact(tokens: number): string {
  if (tokens <= 0) return '0'
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toFixed(0)
}

export function formatClawdAmount(tokens: number): string {
  if (tokens <= 0) return '0'
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(2)}B`
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`
  if (tokens >= 1_000) return Math.round(tokens).toLocaleString('en-US')
  return tokens.toFixed(2)
}

export function formatEthAmount(eth: number): string {
  if (eth <= 0) return '0'
  if (eth < 0.0001) return eth.toExponential(2)
  return eth.toFixed(6).replace(/\.?0+$/, '')
}

export function formatLastBurnLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  // Always Eastern so the label matches Base/chain time, not the visitor's browser TZ.
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
