import { randomBytes } from 'crypto'
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
import { getRedis } from '@/lib/redis'
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

const TREASURY_SEND_LOCK_KEY = 'build-report:promo-treasury-send-lock'
const TREASURY_LOCK_TTL_SEC = 90
const TREASURY_LOCK_WAIT_MS = 85_000

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

function isNonceTooLow(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('Nonce too low') || msg.includes('NonceTooLow')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withTreasurySendLock<T>(fn: () => Promise<T>): Promise<T> {
  const redis = getRedis()
  const lockToken = randomBytes(8).toString('hex')
  const deadline = Date.now() + TREASURY_LOCK_WAIT_MS
  let acquired = false

  while (Date.now() < deadline) {
    const ok = await redis.set(TREASURY_SEND_LOCK_KEY, lockToken, { nx: true, ex: TREASURY_LOCK_TTL_SEC })
    if (ok) {
      acquired = true
      break
    }
    await sleep(400)
  }

  if (!acquired) {
    throw new Error('Promo treasury is busy — retry the rescore in a moment')
  }

  try {
    return await fn()
  } finally {
    try {
      const current = await redis.get<string>(TREASURY_SEND_LOCK_KEY)
      if (current === lockToken) await redis.del(TREASURY_SEND_LOCK_KEY)
    } catch {
      // lock expires via TTL
    }
  }
}

async function getTreasuryPendingNonce(): Promise<number> {
  const account = getTreasuryAccount()
  if (!account) throw new Error('Promo treasury is not configured')
  const publicClient = createBasePublicClient()
  return publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })
}

async function sendTreasuryEth(
  to: `0x${string}`,
  valueWei: bigint,
  nonce: number,
): Promise<PromoTxResult> {
  const wallet = createTreasuryWalletClient()
  const account = getTreasuryAccount()
  if (!wallet || !account) {
    throw new Error('Promo treasury is not configured')
  }

  // #region agent log
  console.log('[promo-treasury-nonce]', JSON.stringify({
    event: 'send-start',
    to,
    valueWei: valueWei.toString(),
    nonce,
    from: account.address,
  }))
  // #endregion

  let hash: `0x${string}`
  try {
    hash = await wallet.sendTransaction({
      to,
      value: valueWei,
      chain: base,
      nonce,
    })
  } catch (err) {
    // #region agent log
    console.log('[promo-treasury-nonce]', JSON.stringify({
      event: 'send-failed',
      to,
      nonce,
      error: err instanceof Error ? err.message : String(err),
    }))
    // #endregion
    throw err
  }

  // Broadcast only — waiting for receipts here regularly blew past route maxDuration
  // (AI score + 2× confirmation) and skipped recordRescoreFundedCount. Client already
  // treats payoutPending when confirmed is false.
  console.log('[promo-treasury-nonce]', JSON.stringify({
    event: 'send-broadcast',
    to,
    nonce,
    hash,
  }))
  return { hash, confirmed: false }
}

async function sendTreasuryEthWithRetry(
  to: `0x${string}`,
  valueWei: bigint,
  nonce: number,
): Promise<PromoTxResult> {
  try {
    return await sendTreasuryEth(to, valueWei, nonce)
  } catch (err) {
    if (!isNonceTooLow(err)) throw err
    const refreshed = await getTreasuryPendingNonce()
    // #region agent log
    console.log('[promo-treasury-nonce]', JSON.stringify({
      event: 'nonce-retry',
      to,
      failedNonce: nonce,
      refreshedNonce: refreshed,
    }))
    // #endregion
    return sendTreasuryEth(to, valueWei, refreshed)
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

  return withTreasurySendLock(async () => {
    const nonce = await getTreasuryPendingNonce()
    return sendTreasuryEthWithRetry(getAddress(toAddress), rewardWei, nonce)
  })
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

  return withTreasurySendLock(async () => {
    let nonce = await getTreasuryPendingNonce()
    // #region agent log
    console.log('[promo-treasury-nonce]', JSON.stringify({
      event: 'split-start',
      walletAddress,
      totalWei: totalWei.toString(),
      startNonce: nonce,
    }))
    // #endregion

    const burnFundTx = await sendTreasuryEthWithRetry(RECEIVER_BUY_AND_BURN, burnFundWei, nonce)
    nonce += 1
    try {
      const walletTx = await sendTreasuryEthWithRetry(getAddress(walletAddress), walletRewardWei, nonce)
      return { burnFundTx, walletTx }
    } catch (err) {
      // Burn receiver already funded — surface that so callers can still bump the rescore counter.
      const wrapped = err instanceof Error ? err : new Error(String(err))
      ;(wrapped as Error & { burnFundTx?: PromoTxResult }).burnFundTx = burnFundTx
      throw wrapped
    }
  })
}
