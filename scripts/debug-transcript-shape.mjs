import { createPublicClient, defineChain, fallback, http } from 'viem'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const logPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'debug-ba045f.log')

const ABI = [
  {
    type: 'function',
    name: 'getEpisodes',
    stateMutability: 'view',
    inputs: [
      { name: 'index', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'bytes32' },
          { name: 'name', type: 'string' },
          { name: 'slug', type: 'string' },
          { name: 'liveSlug', type: 'string' },
          { name: 'manifest', type: 'string' },
          { name: 'contractAddr', type: 'address' },
          { name: 'datetime', type: 'uint256' },
          { name: 'addedAt', type: 'uint256' },
          { name: 'nextId', type: 'bytes32' },
        ],
      },
    ],
  },
]

const mainnet = defineChain({
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://ethereum-rpc.publicnode.com'] } },
})

const client = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http('https://ethereum-rpc.publicnode.com', { timeout: 15_000 }),
    http('https://eth.llamarpc.com', { timeout: 15_000 }),
  ]),
})

const eps = await client.readContract({
  address: '0xF3ce3614fE8cD4294a0bf05D10cFDa9D9cbc4886',
  abi: ABI,
  functionName: 'getEpisodes',
  args: [1n, 3n],
})

const gateways = [
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
]

function summarize(val) {
  if (val == null) return { type: String(val) }
  if (typeof val !== 'object') return { type: typeof val, value: String(val).slice(0, 200) }
  if (Array.isArray(val)) {
    return {
      type: 'array',
      length: val.length,
      first: val[0] == null ? null : typeof val[0] === 'object' ? Object.keys(val[0]) : typeof val[0],
      sample: JSON.stringify(val[0]).slice(0, 300),
    }
  }
  return {
    type: 'object',
    keys: Object.keys(val),
    sample: JSON.stringify(val).slice(0, 500),
  }
}

const findings = []
for (const ep of eps) {
  const cid = ep.manifest.replace(/^ipfs:\/\//, '')
  let parsed = null
  let usedGateway = null
  for (const g of gateways) {
    try {
      const res = await fetch(g + cid, { signal: AbortSignal.timeout(20_000) })
      const text = await res.text()
      if (!res.ok || !text.trim().startsWith('{')) {
        console.log(ep.slug, g, 'fail', res.status, text.slice(0, 80))
        continue
      }
      parsed = JSON.parse(text)
      usedGateway = g
      break
    } catch (e) {
      console.log(ep.slug, g, 'err', e.message)
    }
  }
  if (!parsed) {
    findings.push({ slug: ep.slug, error: 'could not fetch manifest' })
    continue
  }
  const row = {
    slug: ep.slug,
    gateway: usedGateway,
    transcript: summarize(parsed.transcript),
    chat: summarize(parsed.chat),
    video: summarize(parsed.video),
  }
  findings.push(row)
  console.log(JSON.stringify(row, null, 2))
}

writeFileSync(
  logPath,
  JSON.stringify({
    sessionId: 'ba045f',
    location: 'scripts/debug-transcript-shape.mjs',
    message: 'transcript field shape',
    hypothesisId: 'H1',
    timestamp: Date.now(),
    data: findings,
  }) + '\n',
  { flag: 'a' },
)
