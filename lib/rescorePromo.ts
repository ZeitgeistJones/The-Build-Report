import { randomBytes } from 'crypto'
import { getRedis } from '@/lib/redis'
import { SCORE_PAYMENT_WEI } from '@/lib/web3/constants'
import { countCommitsSinceScore } from '@/lib/commitsSinceScore'
import type { RepoActivitySnapshot } from '@/lib/rescoreGuards'
import { formatEthAmount } from '@/lib/clawdBurnIndex'
import { formatApproxUsdFromEth, formatPerCommitRewardUsd } from '@/lib/promoUsd'
import { resolveRepoBeforeRescore } from '@/lib/autoscore'
import { getGitHubStatsForDisplay } from '@/lib/githubStatsSnapshot'

const NONCE_PREFIX = 'build-report:promo-nonce:'
const PAYOUT_PREFIX = 'build-report:promo-payout:'
const SPONSORED_COUNT_KEY = 'build-report:promo:sponsored-count'
const SPONSORED_ETH_KEY = 'build-report:promo:eth-paid-total'
const NONCE_TTL_SEC = 300

export type PromoConfig = {
  enabled: boolean
  endsAt: string | null
  pennyEth: number
  pennyWei: bigint
  maxCommits: number
  minStale: number
  minTreasuryEth: number
  maxPayoutsPerWallet: number | null
}

export type PromoRewardQuote = {
  promoActive: boolean
  promoEndsAt: string | null
  eligible: boolean
  staleCommits: number
  rewardWei: bigint
  rewardEth: number
  treasuryFunded: boolean
  reason: string | null
  buttonLabel: string
  promoBanner: string | null
}

function parseBool(raw: string | undefined): boolean {
  return raw === 'true' || raw === '1'
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function parseEth(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function getPromoConfig(): PromoConfig {
  const pennyEth = parseEth(process.env.RESCORE_PROMO_PENNY_ETH, 0.000004)
  const pennyWei = BigInt(Math.round(pennyEth * 1e18))
  const maxPayoutsRaw = process.env.RESCORE_PROMO_MAX_PAYOUTS_PER_WALLET
  const maxPayouts = maxPayoutsRaw ? parsePositiveInt(maxPayoutsRaw, 0) : null

  return {
    enabled: parseBool(process.env.RESCORE_PROMO_ENABLED),
    endsAt: process.env.RESCORE_PROMO_ENDS_AT?.trim() || null,
    pennyEth,
    pennyWei,
    maxCommits: parsePositiveInt(process.env.RESCORE_PROMO_MAX_COMMITS, 25),
    minStale: parsePositiveInt(process.env.RESCORE_PROMO_MIN_STALE, 1),
    minTreasuryEth: parseEth(process.env.RESCORE_PROMO_MIN_TREASURY_ETH, 0.001),
    maxPayoutsPerWallet: maxPayouts && maxPayouts > 0 ? maxPayouts : null,
  }
}

export function isPromoWindowOpen(config: PromoConfig = getPromoConfig()): boolean {
  if (!config.enabled) return false
  if (!process.env.RESCORE_PROMO_TREASURY_PRIVATE_KEY?.trim()) return false
  if (!config.endsAt) return true
  const end = new Date(config.endsAt).getTime()
  return !Number.isNaN(end) && Date.now() < end
}

export function getPromoStatusForDisplay(): {
  active: boolean
  endsAt: string | null
  pennyEth: number
} {
  const config = getPromoConfig()
  return {
    active: isPromoWindowOpen(config),
    endsAt: config.endsAt,
    pennyEth: config.pennyEth,
  }
}

export function computeStaleCommitCount(activity: RepoActivitySnapshot): number {
  if (!activity.scoredAt) return 0
  const { count, exact, hasNew } = countCommitsSinceScore(
    activity.scoredAt,
    activity.commitTimestamps,
    { lastCommitAt: activity.lastCommitAt, pushedAt: activity.pushedAt },
  )
  if (exact && count > 0) return count
  // UI can show "new commits since scored" before we have exact timestamps — credit 1 for promo.
  if (!exact && hasNew) return 1
  return 0
}

export function computePromoReward(
  activity: RepoActivitySnapshot,
  config: PromoConfig = getPromoConfig(),
): { staleCommits: number; rewardWei: bigint; rewardEth: number } {
  const staleCommits = computeStaleCommitCount(activity)
  if (!isPromoWindowOpen(config) || staleCommits < config.minStale) {
    return { staleCommits, rewardWei: BigInt(0), rewardEth: 0 }
  }
  const credited = Math.min(staleCommits, config.maxCommits)
  const rewardWei = BigInt(credited) * config.pennyWei
  return { staleCommits, rewardWei, rewardEth: Number(rewardWei) / 1e18 }
}

export function promoSignMessage(repoSlug: string, nonce: string): string {
  return `The Build Report rescore promo\nRepo: ${repoSlug}\nNonce: ${nonce}`
}

export async function issuePromoNonce(walletAddress: string, repoSlug: string): Promise<{
  nonce: string
  message: string
  expiresInSec: number
}> {
  const nonce = randomBytes(16).toString('hex')
  const key = `${NONCE_PREFIX}${walletAddress.toLowerCase()}:${nonce}`
  const r = getRedis()
  await r.set(key, repoSlug, { ex: NONCE_TTL_SEC })
  return {
    nonce,
    message: promoSignMessage(repoSlug, nonce),
    expiresInSec: NONCE_TTL_SEC,
  }
}

export async function peekPromoNonce(
  walletAddress: string,
  repoSlug: string,
  nonce: string,
): Promise<boolean> {
  const key = `${NONCE_PREFIX}${walletAddress.toLowerCase()}:${nonce}`
  const r = getRedis()
  const stored = await r.get<string>(key)
  return stored === repoSlug
}

export async function consumePromoNonce(
  walletAddress: string,
  repoSlug: string,
  nonce: string,
): Promise<boolean> {
  const key = `${NONCE_PREFIX}${walletAddress.toLowerCase()}:${nonce}`
  const r = getRedis()
  const stored = await r.get<string>(key)
  if (!stored || stored !== repoSlug) return false
  await r.del(key)
  return true
}

export async function markPromoPayout(
  walletAddress: string,
  repoSlug: string,
  nonce: string,
  payoutTxHash: string,
  rewardEth: number,
): Promise<void> {
  const r = getRedis()
  const payoutKey = `${PAYOUT_PREFIX}${walletAddress.toLowerCase()}:${repoSlug}:${nonce}`
  await Promise.all([
    r.set(payoutKey, payoutTxHash, { ex: 60 * 60 * 24 * 30 }),
    r.incr(SPONSORED_COUNT_KEY),
    r.incrbyfloat(SPONSORED_ETH_KEY, rewardEth),
    r.incr(`build-report:promo:wallet-payouts:${walletAddress.toLowerCase()}`),
  ])
}

export async function hasPromoPayout(
  walletAddress: string,
  repoSlug: string,
  nonce: string,
): Promise<boolean> {
  const r = getRedis()
  const payoutKey = `${PAYOUT_PREFIX}${walletAddress.toLowerCase()}:${repoSlug}:${nonce}`
  const existing = await r.get(payoutKey)
  return Boolean(existing)
}

export async function getWalletPromoPayoutCount(walletAddress: string): Promise<number> {
  try {
    const r = getRedis()
    const raw = await r.get<number>(`build-report:promo:wallet-payouts:${walletAddress.toLowerCase()}`)
    return typeof raw === 'number' ? raw : 0
  } catch {
    return 0
  }
}

export async function buildPromoQuote(
  activity: RepoActivitySnapshot,
  treasuryBalanceEth: number | null,
  walletAddress?: string | null,
): Promise<PromoRewardQuote> {
  const config = getPromoConfig()
  const promoActive = isPromoWindowOpen(config)
  const { staleCommits, rewardWei, rewardEth } = computePromoReward(activity, config)
  const treasuryFunded =
    treasuryBalanceEth !== null && treasuryBalanceEth >= config.minTreasuryEth &&
    treasuryBalanceEth * 1e18 >= Number(rewardWei) + 0.00005 * 1e18

  let eligible = promoActive && staleCommits >= config.minStale && rewardWei > BigInt(0) && treasuryFunded
  let reason: string | null = null

  if (!promoActive) {
    reason = 'Promo is not active'
  } else if (!activity.scoredAt) {
    reason = 'Promo applies to rescored repos with stale commits'
    eligible = false
  } else if (staleCommits < config.minStale) {
    reason = 'No commits since last score'
    eligible = false
  } else if (!treasuryFunded) {
    reason = 'Promo treasury is low — paid rescore still available'
    eligible = false
  } else if (walletAddress && config.maxPayoutsPerWallet) {
    const used = await getWalletPromoPayoutCount(walletAddress)
    if (used >= config.maxPayoutsPerWallet) {
      eligible = false
      reason = 'Promo payout limit reached for this wallet'
    }
  }

  const feeEth = Number(SCORE_PAYMENT_WEI) / 1e18
  let buttonLabel = `Rescore (${formatEthAmount(feeEth)} ETH)`
  if (eligible) {
    buttonLabel = `Rescore free · earn ${formatApproxUsdFromEth(rewardEth)}`
  }

  const perCommitUsd = formatPerCommitRewardUsd(config.pennyEth)
  const promoBanner = eligible
    ? `Launch promo (limited time): free rescore on stale repos — ${perCommitUsd} to your wallet (paid in ETH).`
    : null

  return {
    promoActive,
    promoEndsAt: config.endsAt,
    eligible,
    staleCommits,
    rewardWei,
    rewardEth,
    treasuryFunded,
    reason,
    buttonLabel,
    promoBanner,
  }
}

export function repoToActivitySnapshot(repo: {
  scoredAt?: string | null
  lastCommitAt?: string | null
  pushedAt?: string | null
  commits7d?: number | null
  commits30d?: number | null
  commitTimestamps?: string[] | null
  adminNote?: string | null
  scoringContextVersion?: number
}): RepoActivitySnapshot {
  return {
    scoredAt: repo.scoredAt ?? null,
    lastCommitAt: repo.lastCommitAt ?? null,
    pushedAt: repo.pushedAt ?? null,
    commits7d: repo.commits7d ?? null,
    commits30d: repo.commits30d ?? null,
    commitTimestamps: repo.commitTimestamps ?? null,
    adminNote: repo.adminNote ?? null,
    scoringContextVersion: repo.scoringContextVersion,
  }
}

/** Merge cached score metadata with live GitHub activity — same inputs the repo card uses. */
export async function resolvePromoActivitySnapshot(
  repoSlug: string,
): Promise<RepoActivitySnapshot | null> {
  const repo = await resolveRepoBeforeRescore(repoSlug)
  if (!repo) return null

  const stats = await getGitHubStatsForDisplay()
  const activity = stats?.repoActivity[repoSlug]
  const githubRepo =
    stats?.trackableRepos?.find(r => r.name === repoSlug) ??
    stats?.repos?.find(r => r.name === repoSlug)

  return repoToActivitySnapshot({
    scoredAt: repo.scoredAt,
    lastCommitAt: activity?.lastCommitAt ?? null,
    pushedAt: githubRepo?.pushedAt ?? activity?.pushedAt ?? null,
    commits7d: activity?.commits7d ?? null,
    commits30d: activity?.commits30d ?? null,
    commitTimestamps: activity?.commitTimestamps ?? null,
    adminNote: repo.adminNote ?? null,
    scoringContextVersion: repo.scoringContextVersion,
  })
}
