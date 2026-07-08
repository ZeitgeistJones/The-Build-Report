import {
  createPublicClient,
  createWalletClient,
  defineChain,
  fallback,
  getAddress,
  http,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { BASE_CHAIN_ID } from '@/lib/web3/constants'

const base = defineChain({
  id: BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://mainnet.base.org'] } },
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

function normalizePrivateKey(raw: string): `0x${string}` {
  const trimmed = raw.trim()
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`
}

export function getTreasuryPrivateKey(): `0x${string}` | null {
  const raw = process.env.RESCORE_PROMO_TREASURY_PRIVATE_KEY?.trim()
  if (!raw) return null
  return normalizePrivateKey(raw)
}

export function getTreasuryAccount() {
  const key = getTreasuryPrivateKey()
  if (!key) return null
  return privateKeyToAccount(key)
}

export function getTreasuryAddress(): `0x${string}` | null {
  return getTreasuryAccount()?.address ?? null
}

function createBasePublicClient() {
  return createPublicClient({
    chain: base,
    transport: baseTransport(),
  })
}

function createTreasuryWalletClient() {
  const account = getTreasuryAccount()
  if (!account) return null
  return createWalletClient({
    account,
    chain: base,
    transport: baseTransport(),
  })
}

const GAS_BUFFER_WEI = parseEther('0.00005')

export async function getTreasuryBalanceEth(): Promise<number | null> {
  const address = getTreasuryAddress()
  if (!address) return null
  try {
    const client = createBasePublicClient()
    const wei = await client.getBalance({ address })
    return Number(wei) / 1e18
  } catch {
    return null
  }
}

export async function treasuryCanCover(rewardWei: bigint): Promise<boolean> {
  const address = getTreasuryAddress()
  if (!address || rewardWei <= BigInt(0)) return false
  try {
    const client = createBasePublicClient()
    const balance = await client.getBalance({ address })
    return balance >= rewardWei + GAS_BUFFER_WEI
  } catch {
    return false
  }
}

export async function sendPromoReward(
  toAddress: string,
  rewardWei: bigint,
): Promise<`0x${string}`> {
  if (rewardWei <= BigInt(0)) {
    throw new Error('Reward amount must be positive')
  }

  const wallet = createTreasuryWalletClient()
  if (!wallet) {
    throw new Error('Promo treasury is not configured')
  }

  const canCover = await treasuryCanCover(rewardWei)
  if (!canCover) {
    throw new Error('Promo treasury balance is too low for this reward')
  }

  const hash = await wallet.sendTransaction({
    to: getAddress(toAddress),
    value: rewardWei,
  })

  const publicClient = createBasePublicClient()
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 })
  if (receipt.status !== 'success') {
    throw new Error('Promo reward transaction failed')
  }

  return hash
}
