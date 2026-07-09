/**
 * Probe Slop.Computer episodes + IPFS manifests (no server needed).
 * Usage: node scripts/debug-podcast-manifests.mjs
 */
import { createPublicClient, defineChain, fallback, http } from 'viem'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const logPath = join(__dirname, '..', 'debug-ba045f.log')

const SLOP_COMPUTER_ADDRESS = '0xF3ce3614fE8cD4294a0bf05D10cFDa9D9cbc4886'
const ABI = [
  {
    type: 'function',
    name: 'episodeCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
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
  rpcUrls: { default: { http: ['https://eth.llamarpc.com'] } },
})

const urls = [
  process.env.MAINNET_RPC_URL,
  'https://eth.llamarpc.com',
  'https://ethereum-rpc.publicnode.com',
  'https://1rpc.io/eth',
].filter(Boolean)

const client = createPublicClient({
  chain: mainnet,
  transport: fallback(urls.map(u => http(u, { timeout: 15_000 }))),
})

function ipfsToGatewayUrl(ipfsUri) {
  const cid = ipfsUri.replace(/^ipfs:\/\//, '')
  return `https://ipfs.io/ipfs/${cid}`
}

function logLine(payload) {
  writeFileSync(logPath, JSON.stringify({ sessionId: 'ba045f', timestamp: Date.now(), ...payload }) + '\n', {
    flag: 'a',
  })
}

console.log('[podcast-manifest] fetching episodeCount…')
const count = await client.readContract({
  address: SLOP_COMPUTER_ADDRESS,
  abi: ABI,
  functionName: 'episodeCount',
})
const amount = Math.min(Number(count), 20)
console.log('[podcast-manifest] on-chain count', String(count), 'probing', amount)

const episodes = amount > 0
  ? await client.readContract({
      address: SLOP_COMPUTER_ADDRESS,
      abi: ABI,
      functionName: 'getEpisodes',
      args: [0n, BigInt(amount)],
    })
  : []

const debug = []
for (const ep of episodes) {
  let manifestFetched = false
  let manifestKeys = []
  let transcriptUri = null
  let transcriptLineCount = 0
  let manifestError = null
  let transcriptError = null

  try {
    if (ep.manifest) {
      const url = ipfsToGatewayUrl(ep.manifest)
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      if (res.ok) {
        const json = await res.json()
        manifestFetched = true
        manifestKeys = Object.keys(json)
        for (const key of ['transcript', 'transcriptCid', 'transcriptUri', 'transcript_cid']) {
          if (typeof json[key] === 'string' && json[key].length > 0) {
            transcriptUri = json[key]
            break
          }
        }
        // also surface any key that looks transcript-related
        const transcriptish = manifestKeys.filter(k => /transcript/i.test(k))
        if (!transcriptUri && transcriptish.length) {
          // leave uri null but keys will show the real field names
        }
        if (transcriptUri) {
          const tUrl = ipfsToGatewayUrl(
            transcriptUri.startsWith('ipfs://') ? transcriptUri : `ipfs://${transcriptUri}`,
          )
          const tRes = await fetch(tUrl, { signal: AbortSignal.timeout(20_000) })
          if (tRes.ok) {
            const text = await tRes.text()
            transcriptLineCount = text.split('\n').filter(l => l.trim()).length
          } else {
            transcriptError = `HTTP ${tRes.status}`
          }
        }
      } else {
        manifestError = `HTTP ${res.status}`
      }
    }
  } catch (err) {
    manifestError = err instanceof Error ? err.message : String(err)
  }

  const row = {
    name: ep.name,
    slug: ep.slug,
    hasManifest: Boolean(ep.manifest),
    manifestPrefix: ep.manifest ? String(ep.manifest).slice(0, 48) : null,
    manifestFetched,
    manifestKeys,
    transcriptUri,
    transcriptLineCount,
    manifestError,
    transcriptError,
  }
  debug.push(row)
  console.log('[podcast-manifest] ep', JSON.stringify(row))
}

const summary = {
  totalEpisodesOnChain: Number(count),
  probed: debug.length,
  withManifest: debug.filter(d => d.hasManifest).length,
  manifestFetchedOk: debug.filter(d => d.manifestFetched).length,
  withTranscriptUri: debug.filter(d => d.transcriptUri).length,
  withTranscriptLines: debug.filter(d => d.transcriptLineCount > 0).length,
  sampleKeys: [...new Set(debug.flatMap(d => d.manifestKeys))].slice(0, 40),
}

console.log('[podcast-manifest] summary', JSON.stringify(summary, null, 2))
logLine({
  location: 'scripts/debug-podcast-manifests.mjs',
  message: 'podcast manifest probe',
  hypothesisId: 'H1-H5',
  data: { summary, debug },
})
console.log('[podcast-manifest] wrote', logPath)
