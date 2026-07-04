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
const MAX_TRANSFER_PAGES = 30

export type OnChainBurnTotals = {
  clawdBurned: number
  /** ISO timestamp of the most recent matching CLAWD→dead transfer */
  lastBurnAt: string | null
}

interface TokenTransferItem {
  timestamp?: string
  transaction_hash?: string
  token?: { address_hash?: string }
  total?: { value?: string }
}

interface TokenTransferPage {
  items?: TokenTransferItem[]
  next_page_params?: Record<string, unknown> | null
}

interface BlockscoutTxDetail {
  to?: { hash?: string } | null
}

function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org', { timeout: 15_000 }),
  })
}

function transfersUrl(cursor?: Record<string, unknown>): string {
  const url = new URL(`${BLOCKSCOUT_V2}/addresses/${CLAWD_DEAD_ADDRESS}/token-transfers`)
  url.searchParams.set('type', 'ERC-20')
  if (cursor) {
    for (const [key, value] of Object.entries(cursor)) {
      if (value != null) url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function fetchBlockscout<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function resolveTxTo(
  hash: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  const key = hash.toLowerCase()
  if (cache.has(key)) return cache.get(key)!

  const detail = await fetchBlockscout<BlockscoutTxDetail>(`${BLOCKSCOUT_V2}/transactions/${hash}`)
  const to = detail?.to?.hash?.toLowerCase() ?? null
  cache.set(key, to)
  return to
}

/**
 * Sum all CLAWD Transfer→dead where the tx was sent to one of `attributedContracts`.
 * Matches the community builds hub rule (Blockscout token-transfers, not RPC receipts).
 */
export async function fetchOnChainBurnTotals(
  attributedContracts: string[],
): Promise<OnChainBurnTotals> {
  const attributed = new Set(attributedContracts.map(c => c.toLowerCase()))
  const clawd = CLAWD_TOKEN_ADDRESS.toLowerCase()
  const txToCache = new Map<string, string | null>()

  let total = BigInt(0)
  let lastBurnAt: string | null = null
  let cursor: Record<string, unknown> | null | undefined = undefined
  let pages = 0

  while (pages < MAX_TRANSFER_PAGES) {
    const page = await fetchBlockscout<TokenTransferPage>(transfersUrl(cursor ?? undefined))
    if (!page?.items?.length) break

    for (const item of page.items) {
      if (item.token?.address_hash?.toLowerCase() !== clawd) continue
      const hash = item.transaction_hash
      if (!hash) continue

      const txTo = await resolveTxTo(hash, txToCache)
      if (!txTo || !attributed.has(txTo)) continue

      const raw = item.total?.value
      if (!raw) continue

      total += BigInt(raw)
      const ts = item.timestamp
      if (ts && (!lastBurnAt || ts > lastBurnAt)) lastBurnAt = ts
    }

    pages += 1
    cursor = page.next_page_params ?? null
    if (!cursor) break
  }

  return { clawdBurned: Number(total) / 1e18, lastBurnAt }
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
