/**
 * Post-fix: confirm extractTranscriptUri-style logic + line fetch works.
 */
import { createPublicClient, defineChain, fallback, http } from 'viem'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const logPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'debug-ba045f.log')
const GATEWAYS = [
  'https://dweb.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
]

function extractTranscriptUri(manifest) {
  const candidates = ['transcript', 'transcriptCid', 'transcriptUri', 'transcript_cid']
  for (const key of candidates) {
    const val = manifest[key]
    if (typeof val === 'string' && val.length > 0) {
      return val.startsWith('ipfs://') ? val : `ipfs://${val}`
    }
    if (val && typeof val === 'object' && typeof val.cid === 'string' && val.cid.length > 0) {
      return val.cid.startsWith('ipfs://') ? val.cid : `ipfs://${val.cid}`
    }
  }
  return null
}

async function fetchIpfsText(ipfsUri) {
  const cid = ipfsUri.replace(/^ipfs:\/\//, '')
  for (const base of GATEWAYS) {
    try {
      const res = await fetch(base + cid, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) continue
      const text = await res.text()
      if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) continue
      return text
    } catch {
      // next
    }
  }
  return null
}

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
  transport: fallback([http('https://ethereum-rpc.publicnode.com', { timeout: 15_000 })]),
})

const eps = await client.readContract({
  address: '0xF3ce3614fE8cD4294a0bf05D10cFDa9D9cbc4886',
  abi: ABI,
  functionName: 'getEpisodes',
  args: [1n, 2n],
})

const results = []
for (const ep of eps) {
  const manifestText = await fetchIpfsText(ep.manifest)
  const manifest = manifestText ? JSON.parse(manifestText) : null
  const transcriptUri = manifest ? extractTranscriptUri(manifest) : null
  let liveLines = 0
  if (transcriptUri) {
    const t = await fetchIpfsText(transcriptUri)
    if (t) {
      for (const raw of t.split('\n')) {
        try {
          const o = JSON.parse(raw.trim())
          if (o.source === 'live' && typeof o.text === 'string') liveLines++
        } catch {
          // skip
        }
      }
    }
  }
  const row = {
    slug: ep.slug,
    transcriptUri,
    liveLines,
    ok: Boolean(transcriptUri && liveLines > 0),
  }
  results.push(row)
  console.log('[extract-fix]', JSON.stringify(row))
}

writeFileSync(
  logPath,
  JSON.stringify({
    sessionId: 'ba045f',
    location: 'scripts/debug-extract-fix.mjs',
    message: 'post-fix extract',
    hypothesisId: 'H1',
    runId: 'post-fix',
    timestamp: Date.now(),
    data: results,
  }) + '\n',
  { flag: 'a' },
)
console.log('[extract-fix] wrote', logPath)
