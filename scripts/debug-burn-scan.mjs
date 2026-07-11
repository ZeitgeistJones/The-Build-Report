// Live CLAWD-burned total via receiver Burned(uint256) RPC getLogs (same primary
// path as lib/clawdBurnIndex.ts). Compares against Redis only when env is set.
import { createPublicClient, defineChain, http, parseAbiItem } from 'viem'

const RECEIVER = '0x0C1a3DB07304D2E4E551AB4A7b083382a33f25ad'
const FROM_BLOCK = BigInt(47_000_000)
const CHUNK = BigInt(9_000)
const BURNED = parseAbiItem('event Burned(uint256 amount)')

const base = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
})

const rpc = process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
const client = createPublicClient({ chain: base, transport: http(rpc, { timeout: 20_000 }) })

const latest = await client.getBlockNumber()
let total = 0n
let lastBlock = null
let chunks = 0
const t0 = Date.now()

for (let start = FROM_BLOCK; start <= latest; start += CHUNK) {
  const end = start + CHUNK - 1n > latest ? latest : start + CHUNK - 1n
  const logs = await client.getLogs({
    address: RECEIVER,
    event: BURNED,
    fromBlock: start,
    toBlock: end,
  })
  for (const log of logs) {
    const amount = log.args?.amount
    if (typeof amount !== 'bigint' || amount <= 0n) continue
    total += amount
    if (log.blockNumber != null && (lastBlock === null || log.blockNumber > lastBlock)) {
      lastBlock = log.blockNumber
    }
  }
  chunks += 1
  if (chunks % 20 === 0) {
    console.error(`… ${chunks} chunks, through ${end}, ${Number(total) / 1e18} CLAWD`)
  }
  await new Promise(r => setTimeout(r, 100))
}

let lastBurnAt = null
if (lastBlock != null) {
  const block = await client.getBlock({ blockNumber: lastBlock })
  lastBurnAt = new Date(Number(block.timestamp) * 1000).toISOString()
}

console.log(
  JSON.stringify(
    {
      clawdBurned: Number(total) / 1e18,
      lastBurnAt,
      eventsIndexedThrough: String(latest),
      chunks,
      ms: Date.now() - t0,
      rpc,
    },
    null,
    2,
  ),
)
