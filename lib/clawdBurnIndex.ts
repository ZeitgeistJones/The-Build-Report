import { createPublicClient, defineChain, http } from 'viem'
import { BASE_CHAIN_ID, CLAWD_TOKEN_ADDRESS } from '@/lib/web3/constants'

const base = defineChain({
  id: BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
})

const BLOCKSCOUT_V2 = 'https://base.blockscout.com/api/v2'
const CLAWD_DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD'
const DEAD_TOPIC =
  '0x000000000000000000000000000000000000000000000000000000000000dead'
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const EXECUTE_METHOD_ID = '61461954'
const MAX_TX_PAGES = 10
const FETCH_TIMEOUT_MS = 8_000
const BURN_INDEX_BUDGET_MS = 12_000

export type OnChainBurnTotals = {
  clawdBurned: number
  /** ISO timestamp of the most recent matching CLAWD→dead transfer */
  lastBurnAt: string | null
  /** False when Blockscout timed out or errored — callers must not treat totals as authoritative. */
  ok: boolean
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

function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org', { timeout: 15_000 }),
  })
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

async function fetchOnChainBurnTotalsInner(
  attributedContracts: string[],
): Promise<OnChainBurnTotals> {
  let total = BigInt(0)
  let lastBurnAt: string | null = null

  for (const contract of attributedContracts) {
    let cursor: Record<string, unknown> | null | undefined = undefined
    let pages = 0

    while (pages < MAX_TX_PAGES) {
      const page: AddressTxPage | null = await fetchBlockscout<AddressTxPage>(
        addressTxUrl(contract, cursor ?? undefined),
      )
      if (!page?.items?.length) break

      for (const tx of page.items) {
        if (!isExecuteTx(tx)) continue

        const logsPage = await fetchBlockscout<TxLogsPage>(
          `${BLOCKSCOUT_V2}/transactions/${tx.hash}/logs`,
        )
        if (!logsPage?.items?.length) continue

        total += clawdToDeadInLogs(logsPage.items)
        const ts = tx.timestamp
        if (ts && (!lastBurnAt || ts > lastBurnAt)) lastBurnAt = ts
      }

      pages += 1
      cursor = page.next_page_params ?? null
      if (!cursor) break
    }
  }

  return { clawdBurned: Number(total) / 1e18, lastBurnAt, ok: true }
}

/**
 * Sum CLAWD→dead in execute() txs to the receiver contract.
 * Same attribution as the community hub (tx.to == receiver) but indexed via
 * receiver transactions — O(executes) not O(all dead-address transfers).
 */
export async function fetchOnChainBurnTotals(
  attributedContracts: string[],
): Promise<OnChainBurnTotals> {
  try {
    return await Promise.race([
      fetchOnChainBurnTotalsInner(attributedContracts),
      new Promise<OnChainBurnTotals>((_, reject) => {
        setTimeout(() => reject(new Error('burn index timeout')), BURN_INDEX_BUDGET_MS)
      }),
    ])
  } catch {
    return { clawdBurned: 0, lastBurnAt: null, ok: false }
  }
}

/** Lifetime CLAWD burned via txs to this receiver contract. */
export async function getClawdBurnedViaContract(contract: string): Promise<number> {
  const { clawdBurned } = await fetchOnChainBurnTotals([contract])
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
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
