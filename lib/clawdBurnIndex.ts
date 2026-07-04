import { createPublicClient, defineChain, http } from 'viem'
import { BASE_CHAIN_ID, CLAWD_TOKEN_ADDRESS } from '@/lib/web3/constants'

const base = defineChain({
  id: BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
})

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const DEAD_TOPIC =
  '0x000000000000000000000000000000000000000000000000000000000000dead'

function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org', { timeout: 15_000 }),
  })
}

interface BlockscoutTx {
  hash: string
  input: string
}

async function fetchContractTxPage(contract: string, page: number): Promise<BlockscoutTx[]> {
  const url = new URL('https://base.blockscout.com/api')
  url.searchParams.set('module', 'account')
  url.searchParams.set('action', 'txlist')
  url.searchParams.set('address', contract)
  url.searchParams.set('sort', 'asc')
  url.searchParams.set('page', String(page))
  url.searchParams.set('offset', '100')

  const res = await fetch(url.toString(), { next: { revalidate: 300 } })
  if (!res.ok) return []

  const data = (await res.json()) as { status?: string; result?: BlockscoutTx[] }
  if (data.status !== '1' || !Array.isArray(data.result)) return []
  return data.result
}

function clawdToDeadInLogs(
  logs: { address: string; topics: readonly `0x${string}`[]; data: `0x${string}` }[],
): bigint {
  let total = 0n
  const token = CLAWD_TOKEN_ADDRESS.toLowerCase()

  for (const log of logs) {
    if (log.address.toLowerCase() !== token) continue
    if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue
    if (log.topics[2]?.toLowerCase() !== DEAD_TOPIC) continue
    total += BigInt(log.data)
  }

  return total
}

/** Sum CLAWD sent to dead in any non-receive tx to this contract (execute, incinerate, burn, etc.). */
export async function getClawdBurnedViaContract(contract: string): Promise<number> {
  const client = createBaseClient()
  let total = 0n
  let page = 1

  for (;;) {
    const txs = await fetchContractTxPage(contract, page)
    if (!txs.length) break

    for (const tx of txs) {
      const input = tx.input?.toLowerCase() ?? '0x'
      if (input === '0x' || input === '') continue

      try {
        const receipt = await client.getTransactionReceipt({ hash: tx.hash as `0x${string}` })
        if (receipt.status === 'success') {
          total += clawdToDeadInLogs(receipt.logs)
        }
      } catch {
        // skip unreadable receipts
      }
    }

    if (txs.length < 100) break
    page += 1
    if (page > 30) break
  }

  return Number(total) / 1e18
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

export function formatClawdAmount(tokens: number): string {
  if (tokens <= 0) return '0'
  if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(2)}B`
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`
  if (tokens >= 1_000) return `${Math.round(tokens).toLocaleString('en-US')}`
  return tokens.toFixed(2)
}

export function formatEthAmount(eth: number): string {
  if (eth <= 0) return '0'
  if (eth < 0.0001) return eth.toExponential(2)
  return eth.toFixed(6).replace(/\.?0+$/, '')
}
