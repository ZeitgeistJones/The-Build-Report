import { createPublicClient, defineChain, fallback, getAddress, http, isAddressEqual } from 'viem'
import {
  BASE_CHAIN_ID,
  CLAWD_GATE_ABI,
  CLAWD_GATE_ADDRESS,
  CLAWD_GATE_TIER,
  RECEIVER_BUY_AND_BURN,
  SCORE_PAYMENT_WEI,
} from './constants'

const base = defineChain({
  id: BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
})

const BASE_HTTP_RPCS = [
  process.env.BASE_RPC_URL,
  process.env.NEXT_PUBLIC_BASE_RPC_URL,
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://base-rpc.publicnode.com',
  'https://1rpc.io/base',
].filter((url): url is string => Boolean(url?.trim()))

function baseTransport() {
  const urls = BASE_HTTP_RPCS
  const httpOpts = { timeout: 15_000 }
  if (urls.length <= 1) return http(urls[0] ?? 'https://mainnet.base.org', httpOpts)
  return fallback(urls.map(url => http(url, httpOpts)))
}

function createBaseClient() {
  return createPublicClient({
    chain: base,
    transport: baseTransport(),
  })
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getBlockTimestamp(
  blockNumber: bigint,
  blockHash?: `0x${string}`,
): Promise<number> {
  let lastErr: unknown

  for (const rpcUrl of BASE_HTTP_RPCS) {
    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl, { timeout: 15_000 }),
    })

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (blockHash) {
          try {
            const byHash = await client.getBlock({ blockHash })
            return Number(byHash.timestamp)
          } catch {
            // fall through to block number on this RPC
          }
        }
        const byNumber = await client.getBlock({ blockNumber })
        return Number(byNumber.timestamp)
      } catch (err) {
        lastErr = err
        await sleep(600 * (attempt + 1))
      }
    }
  }

  const detail = lastErr instanceof Error ? lastErr.message : 'unknown RPC error'
  throw new Error(
    `Could not verify payment timing (Base RPC unavailable). Try again in a few seconds. (${detail})`,
  )
}

export async function verifyPaymentTx(
  txHash: string,
  walletAddress: string,
  expectedWei: bigint = SCORE_PAYMENT_WEI,
): Promise<void> {
  const hash = txHash as `0x${string}`
  const client = createBaseClient()

  const receipt = await client.getTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error('Transaction was not successful')
  }

  const blockTimestamp = await getBlockTimestamp(receipt.blockNumber, receipt.blockHash)
  const txAgeSeconds = Math.floor(Date.now() / 1000) - blockTimestamp
  if (txAgeSeconds > 3600) {
    throw new Error('Transaction is too old — must be used within 1 hour')
  }

  const tx = await client.getTransaction({ hash })
  const from = getAddress(tx.from)
  const expectedFrom = getAddress(walletAddress)
  if (!isAddressEqual(from, expectedFrom)) {
    throw new Error('Transaction sender does not match wallet')
  }

  if (!tx.to || !isAddressEqual(getAddress(tx.to), getAddress(RECEIVER_BUY_AND_BURN))) {
    throw new Error('Transaction was not sent to the receiver-buy-and-burn contract')
  }

  if (tx.value !== expectedWei) {
    throw new Error('Incorrect payment amount')
  }

  const hasAccess = await client.readContract({
    address: CLAWD_GATE_ADDRESS,
    abi: CLAWD_GATE_ABI,
    functionName: 'hasAccess',
    args: [getAddress(walletAddress), CLAWD_GATE_TIER],
  })
  if (!hasAccess) {
    throw new Error('Wallet does not meet CLAWDGate access requirements')
  }
}

/** CLAWDGate tier-1 check without requiring a payment (used for free, signed votes). */
export async function walletHasGateAccess(walletAddress: string): Promise<boolean> {
  const client = createBaseClient()
  const hasAccess = await client.readContract({
    address: CLAWD_GATE_ADDRESS,
    abi: CLAWD_GATE_ABI,
    functionName: 'hasAccess',
    args: [getAddress(walletAddress), CLAWD_GATE_TIER],
  })
  return !!hasAccess
}

/** Verify a personal_sign message. Uses client-side verify so smart wallets (ERC-1271/6492) work. */
export async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string,
): Promise<boolean> {
  const client = createBaseClient()
  try {
    return await client.verifyMessage({
      address: getAddress(walletAddress),
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    return false
  }
}
