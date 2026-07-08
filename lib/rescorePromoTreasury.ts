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
import { BASE_CHAIN_ID, RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'

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
const SPLIT_PAYOUT_GAS_BUFFER_WEI = parseEther('0.0001')

export type PromoTxResult = { hash: `0x${string}`; confirmed: boolean }

async function sendTreasuryEth(
  to: `0x${string}`,
  valueWei: bigint,
): Promise<PromoTxResult> {
  const wallet = createTreasuryWalletClient()
  if (!wallet) {
    throw new Error('Promo treasury is not configured')
  }

  const hash = await wallet.sendTransaction({
    to,
    value: valueWei,
    chain: base,
  })

  const publicClient = createBasePublicClient()
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 25_000 })
    if (receipt.status !== 'success') {
      throw new Error('Promo treasury transaction failed on-chain')
    }
    return { hash, confirmed: true }
  } catch (err) {
    console.warn('[promo-treasury] tx broadcast; receipt unconfirmed:', hash, err)
    return { hash, confirmed: false }
  }
}

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

export async function treasuryCanCover(totalWei: bigint, splitPayout = false): Promise<boolean> {
  const address = getTreasuryAddress()
  if (!address || totalWei <= BigInt(0)) return false
  const gasBuffer = splitPayout ? SPLIT_PAYOUT_GAS_BUFFER_WEI : GAS_BUFFER_WEI
  try {
    const client = createBasePublicClient()
    const balance = await client.getBalance({ address })
    return balance >= totalWei + gasBuffer
  } catch {
    return false
  }
}

export async function sendPromoReward(
  toAddress: string,
  rewardWei: bigint,
): Promise<PromoTxResult> {
  if (rewardWei <= BigInt(0)) {
    throw new Error('Reward amount must be positive')
  }

  if (!(await treasuryCanCover(rewardWei))) {
    throw new Error('Promo treasury balance is too low for this reward')
  }

  return sendTreasuryEth(getAddress(toAddress), rewardWei)
}

export async function sendPromoSplitReward(
  walletAddress: string,
  totalWei: bigint,
  burnFundWei: bigint,
  walletRewardWei: bigint,
): Promise<{ burnFundTx: PromoTxResult; walletTx: PromoTxResult }> {
  if (totalWei <= BigInt(0) || burnFundWei <= BigInt(0) || walletRewardWei <= BigInt(0)) {
    throw new Error('Promo split amounts must be positive')
  }
  if (burnFundWei + walletRewardWei !== totalWei) {
    throw new Error('Promo split amounts must sum to total')
  }

  if (!(await treasuryCanCover(totalWei, true))) {
    throw new Error('Promo treasury balance is too low for this reward')
  }

  const burnFundTx = await sendTreasuryEth(RECEIVER_BUY_AND_BURN, burnFundWei)
  const walletTx = await sendTreasuryEth(getAddress(walletAddress), walletRewardWei)
  return { burnFundTx, walletTx }
}
