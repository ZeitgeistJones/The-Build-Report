import { createPublicClient, defineChain, fallback, http } from 'viem'

const mainnet = defineChain({
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://eth.llamarpc.com'] },
  },
})

const MAINNET_HTTP_RPCS = [
  process.env.MAINNET_RPC_URL,
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
  'https://eth.llamarpc.com',
  'https://ethereum-rpc.publicnode.com',
  'https://1rpc.io/eth',
].filter((url): url is string => Boolean(url?.trim()))

function mainnetTransport() {
  const urls = MAINNET_HTTP_RPCS
  const httpOpts = { timeout: 15_000 }
  if (urls.length <= 1) return http(urls[0] ?? 'https://eth.llamarpc.com', httpOpts)
  return fallback(urls.map(url => http(url, httpOpts)))
}

function createMainnetClient() {
  return createPublicClient({
    chain: mainnet,
    transport: mainnetTransport(),
  })
}

export const SLOP_COMPUTER_ADDRESS = '0xF3ce3614fE8cD4294a0bf05D10cFDa9D9cbc4886' as const

const SLOP_COMPUTER_ABI = [
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
] as const

export type SlopEpisode = {
  id: string
  name: string
  slug: string
  liveSlug: string
  manifest: string
  contractAddr: string
  datetime: bigint
  addedAt: bigint
  nextId: string
}

const SLOP_COMPUTER_ORIGIN = 'https://slop.computer'

/** Canonical public page URL for a Slop.Computer episode (e.g. https://slop.computer/auryn-macmillan). */
export function episodePublicUrl(slug: string): string {
  return `${SLOP_COMPUTER_ORIGIN}/${slug}`
}

export async function fetchAllEpisodes(maxAmount = 200): Promise<SlopEpisode[]> {
  const client = createMainnetClient()
  const count = await client.readContract({
    address: SLOP_COMPUTER_ADDRESS,
    abi: SLOP_COMPUTER_ABI,
    functionName: 'episodeCount',
  })

  const amount = Math.min(Number(count), maxAmount)
  if (amount <= 0) return []

  const episodes = await client.readContract({
    address: SLOP_COMPUTER_ADDRESS,
    abi: SLOP_COMPUTER_ABI,
    functionName: 'getEpisodes',
    args: [BigInt(0), BigInt(amount)],
  })

  return episodes.map(ep => ({
    id: ep.id,
    name: ep.name,
    slug: ep.slug,
    liveSlug: ep.liveSlug,
    manifest: ep.manifest,
    contractAddr: ep.contractAddr,
    datetime: ep.datetime,
    addedAt: ep.addedAt,
    nextId: ep.nextId,
  }))
}

const IPFS_GATEWAYS = [
  'https://dweb.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
]

export function ipfsCid(ipfsUri: string): string {
  return ipfsUri.replace(/^ipfs:\/\//, '')
}

export function ipfsToGatewayUrl(ipfsUri: string, gatewayIndex = 0): string {
  const cid = ipfsCid(ipfsUri)
  const base = IPFS_GATEWAYS[gatewayIndex] ?? IPFS_GATEWAYS[0]
  return `${base}${cid}`
}

/** Fetch IPFS content trying multiple gateways (ipfs.io alone often times out). */
export async function fetchIpfsText(
  ipfsUri: string,
  timeoutMs = 20_000,
): Promise<string | null> {
  const cid = ipfsCid(ipfsUri)
  for (const base of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${base}${cid}`, { signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) continue
      const text = await res.text()
      // Gateways sometimes return HTML error pages with 200
      if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) continue
      return text
    } catch {
      // try next gateway
    }
  }
  return null
}
