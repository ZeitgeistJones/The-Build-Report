import { randomBytes } from 'crypto'
import { getRedis } from '@/lib/redis'
import { SCORE_PAYMENT_WEI } from '@/lib/web3/constants'
import { countCommitsSinceScore } from '@/lib/commitsSinceScore'
import type { RepoActivitySnapshot } from '@/lib/rescoreGuards'
import { formatApproxUsdFromEth, formatPerCommitRewardUsd, formatRescorePriceLabel } from '@/lib/promoUsd'
import { getEthUsdRateCached } from '@/lib/ethUsdRate'
import { APPROX_USD_NOTE_SHORT } from '@/lib/scoringCopy'
import { resolveRepoBeforeRescore } from '@/lib/autoscore'
import { fetchRepoBySlug } from '@/lib/github'
import { getGitHubStatsForDisplay } from '@/lib/githubStatsSnapshot'
import { isUnscoredRecent } from '@/lib/recentRepos'
import { COMMIT_CAP } from '@/lib/commitsSinceScore'

const NONCE_PREFIX = 'build-report:promo-nonce:'
const PAYOUT_PREFIX = 'build-report:promo-payout:'
const SPONSORED_COUNT_KEY = 'build-report:promo:sponsored-count'
const SPONSORED_ETH_KEY = 'build-report:promo:eth-paid-total'
const NONCE_TTL_SEC = 300
/** Per stale commit: half to wallet, half to receiver-buy-and-burn (burn fuel). */
export const PROMO_WALLET_SHARE_BPS = 5000
const DEFAULT_PROMO_TOTAL_ETH = Number(SCORE_PAYMENT_WEI) / 1e18

export type PromoConfig = {
  enabled: boolean
  endsAt: string | null
  /** Total treasury subsidy per stale commit (wallet + burn receiver). */
  pennyEth: number
  pennyWei: bigint
  walletRewardEth: number
  walletRewardWei: bigint
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

export function splitPromoWei(totalWei: bigint): { walletWei: bigint; burnFundWei: bigint } {
  const walletWei = totalWei / BigInt(2)
  return { walletWei, burnFundWei: totalWei - walletWei }
}

export function getPromoConfig(): PromoConfig {
  const pennyEth = parseEth(process.env.RESCORE_PROMO_PENNY_ETH, DEFAULT_PROMO_TOTAL_ETH)
  const pennyWei = BigInt(Math.round(pennyEth * 1e18))
  const { walletWei } = splitPromoWei(pennyWei)
  const maxPayoutsRaw = process.env.RESCORE_PROMO_MAX_PAYOUTS_PER_WALLET
  const maxPayouts = maxPayoutsRaw ? parsePositiveInt(maxPayoutsRaw, 0) : null

  return {
    enabled: parseBool(process.env.RESCORE_PROMO_ENABLED),
    endsAt: process.env.RESCORE_PROMO_ENDS_AT?.trim() || null,
    pennyEth,
    pennyWei,
    walletRewardEth: Number(walletWei) / 1e18,
    walletRewardWei: walletWei,
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
  walletRewardEth: number
} {
  const config = getPromoConfig()
  return {
    active: isPromoWindowOpen(config),
    endsAt: config.endsAt,
    pennyEth: config.pennyEth,
    walletRewardEth: config.walletRewardEth,
  }
}

/** True when this snapshot is a never-scored / awaiting-score repo. */
export function isUnscoredPromoActivity(activity: RepoActivitySnapshot): boolean {
  if ((activity.adminNote ?? '').startsWith('Unscored — visible because')) return true
  return !activity.scoredAt?.trim()
}

/** Commits after GitHub repo creation — drops inherited fork history for first-Score earn. */
export function countCommitsAfterRepoCreated(activity: RepoActivitySnapshot): number {
  const createdMs = activity.createdAt ? new Date(activity.createdAt).getTime() : NaN
  const hasCreated = Number.isFinite(createdMs)

  if (activity.commitTimestamps?.length) {
    const count = activity.commitTimestamps.filter(ts => {
      const ms = new Date(ts).getTime()
      if (!Number.isFinite(ms)) return false
      // Strictly after fork/create so parent history at/before create doesn't pay.
      return !hasCreated || ms > createdMs
    }).length
    return Math.min(count, COMMIT_CAP)
  }

  // No timestamp scan — only credit activity that landed after the repo existed.
  for (const raw of [activity.lastCommitAt, activity.pushedAt]) {
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (!Number.isFinite(ms)) continue
    if (!hasCreated || ms > createdMs) return 1
  }
  return 0
}

/** Commits that count toward the launch promo earn reward. */
export function computeStaleCommitCount(activity: RepoActivitySnapshot): number {
  // First Score: only commits after this GitHub repo was created (not fork parent history).
  if (isUnscoredPromoActivity(activity)) {
    return countCommitsAfterRepoCreated(activity)
  }

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
): {
  staleCommits: number
  totalWei: bigint
  totalEth: number
  rewardWei: bigint
  rewardEth: number
  burnFundWei: bigint
  burnFundEth: number
} {
  const staleCommits = computeStaleCommitCount(activity)
  if (!isPromoWindowOpen(config) || staleCommits < config.minStale) {
    return {
      staleCommits,
      totalWei: BigInt(0),
      totalEth: 0,
      rewardWei: BigInt(0),
      rewardEth: 0,
      burnFundWei: BigInt(0),
      burnFundEth: 0,
    }
  }
  const credited = Math.min(staleCommits, config.maxCommits)
  const totalWei = BigInt(credited) * config.pennyWei
  const { walletWei, burnFundWei } = splitPromoWei(totalWei)
  return {
    staleCommits,
    totalWei,
    totalEth: Number(totalWei) / 1e18,
    rewardWei: walletWei,
    rewardEth: Number(walletWei) / 1e18,
    burnFundWei,
    burnFundEth: Number(burnFundWei) / 1e18,
  }
}

/** Locked at nonce issue time so payout matches the button quote even if Redis score state changes mid-score. */
export type PromoNoncePayload = {
  repoSlug: string
  staleCommits: number
  totalWei: string
  rewardWei: string
  burnFundWei: string
  rewardEth: number
}

export function promoSignMessage(repoSlug: string, nonce: string, rewardEth: number): string {
  return `The Build Report rescore promo\nRepo: ${repoSlug}\nNonce: ${nonce}\nRewardEth: ${rewardEth}`
}

function parsePromoNoncePayload(stored: unknown, repoSlug: string): PromoNoncePayload | null {
  if (!stored) return null
  // Legacy: nonce value was just the repo slug string.
  if (typeof stored === 'string') {
    if (stored === repoSlug) return null
    try {
      const parsed = JSON.parse(stored) as PromoNoncePayload
      if (parsed?.repoSlug === repoSlug && parsed.totalWei && parsed.rewardWei && parsed.burnFundWei) {
        return parsed
      }
    } catch {
      return null
    }
    return null
  }
  if (typeof stored === 'object' && stored !== null) {
    const parsed = stored as PromoNoncePayload
    if (parsed.repoSlug === repoSlug && parsed.totalWei && parsed.rewardWei && parsed.burnFundWei) {
      return parsed
    }
  }
  return null
}

export async function issuePromoNonce(
  walletAddress: string,
  repoSlug: string,
  locked: {
    staleCommits: number
    totalWei: bigint
    rewardWei: bigint
    burnFundWei: bigint
    rewardEth: number
  },
): Promise<{
  nonce: string
  message: string
  expiresInSec: number
  rewardEth: number
  staleCommits: number
}> {
  const nonce = randomBytes(16).toString('hex')
  const key = `${NONCE_PREFIX}${walletAddress.toLowerCase()}:${nonce}`
  const payload: PromoNoncePayload = {
    repoSlug,
    staleCommits: locked.staleCommits,
    totalWei: locked.totalWei.toString(),
    rewardWei: locked.rewardWei.toString(),
    burnFundWei: locked.burnFundWei.toString(),
    rewardEth: locked.rewardEth,
  }
  const r = getRedis()
  await r.set(key, JSON.stringify(payload), { ex: NONCE_TTL_SEC })
  return {
    nonce,
    message: promoSignMessage(repoSlug, nonce, locked.rewardEth),
    expiresInSec: NONCE_TTL_SEC,
    rewardEth: locked.rewardEth,
    staleCommits: locked.staleCommits,
  }
}

export async function peekPromoNonce(
  walletAddress: string,
  repoSlug: string,
  nonce: string,
): Promise<PromoNoncePayload | null> {
  const key = `${NONCE_PREFIX}${walletAddress.toLowerCase()}:${nonce}`
  const r = getRedis()
  const stored = await r.get(key)
  return parsePromoNoncePayload(stored, repoSlug)
}

export async function consumePromoNonce(
  walletAddress: string,
  repoSlug: string,
  nonce: string,
): Promise<PromoNoncePayload | null> {
  const key = `${NONCE_PREFIX}${walletAddress.toLowerCase()}:${nonce}`
  const r = getRedis()
  const stored = await r.get(key)
  const payload = parsePromoNoncePayload(stored, repoSlug)
  if (!payload) return null
  await r.del(key)
  return payload
}

export async function markPromoPayout(
  walletAddress: string,
  repoSlug: string,
  nonce: string,
  payoutTxHash: string,
  walletRewardEth: number,
  totalTreasuryEth: number,
): Promise<void> {
  const r = getRedis()
  const payoutKey = `${PAYOUT_PREFIX}${walletAddress.toLowerCase()}:${repoSlug}:${nonce}`
  await Promise.all([
    r.set(payoutKey, payoutTxHash, { ex: 60 * 60 * 24 * 30 }),
    r.incr(SPONSORED_COUNT_KEY),
    r.incrbyfloat(SPONSORED_ETH_KEY, totalTreasuryEth),
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
  const ethUsdRate = await getEthUsdRateCached()
  const promoActive = isPromoWindowOpen(config)
  const { staleCommits, totalWei, rewardWei, rewardEth } = computePromoReward(activity, config)
  const treasuryFunded =
    treasuryBalanceEth !== null && treasuryBalanceEth >= config.minTreasuryEth &&
    treasuryBalanceEth * 1e18 >= Number(totalWei) + 0.0001 * 1e18

  const firstScore = isUnscoredPromoActivity(activity)
  let eligible = promoActive && staleCommits >= config.minStale && rewardWei > BigInt(0) && treasuryFunded
  let reason: string | null = null

  if (!promoActive) {
    reason = 'Promo is not active'
  } else if (staleCommits < config.minStale) {
    reason = firstScore
      ? 'No commits yet — promo earn needs at least one commit on this repo'
      : 'No commits since last score'
    eligible = false
  } else if (!treasuryFunded) {
    reason = 'Promo treasury is low — try again later'
    eligible = false
  } else if (walletAddress && config.maxPayoutsPerWallet) {
    const used = await getWalletPromoPayoutCount(walletAddress)
    if (used >= config.maxPayoutsPerWallet) {
      eligible = false
      reason = 'Promo payout limit reached for this wallet'
    }
  }

  const feeEth = Number(SCORE_PAYMENT_WEI) / 1e18
  const actionWord = firstScore ? 'Score' : 'Rescore'
  let buttonLabel = `${actionWord} (${formatRescorePriceLabel(feeEth, ethUsdRate)})`
  if (eligible) {
    buttonLabel = `${actionWord} · earn ${formatApproxUsdFromEth(rewardEth, ethUsdRate)}`
  }

  const perCommitUsd = formatPerCommitRewardUsd(config.walletRewardEth, ethUsdRate)
  const promoBanner = eligible
    ? firstScore
      ? `Launch promo: first Score — earn on commits after this repo was created (forks: after the fork) — ${perCommitUsd} to your wallet; half fuels CLAWD burns. ${APPROX_USD_NOTE_SHORT}`
      : `Launch promo: rescore on stale repos — ${perCommitUsd} to your wallet; half fuels CLAWD burns. ${APPROX_USD_NOTE_SHORT}`
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
  createdAt?: string | null
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
    createdAt: repo.createdAt ?? null,
    adminNote: repo.adminNote ?? null,
    scoringContextVersion: repo.scoringContextVersion,
  }
}

/** Merge cached score metadata with live GitHub activity — same inputs the repo card uses. */
export async function resolvePromoActivitySnapshot(
  repoSlug: string,
): Promise<RepoActivitySnapshot | null> {
  const repo = await resolveRepoBeforeRescore(repoSlug)
  const stats = await getGitHubStatsForDisplay()
  const activity = stats?.repoActivity[repoSlug]
  let githubRepo =
    stats?.trackableRepos?.find(r => r.name === repoSlug) ??
    stats?.repos?.find(r => r.name === repoSlug) ??
    null
  // Need created_at to exclude fork parent history from first-Score earn.
  if (!githubRepo?.createdAt) {
    githubRepo = (await fetchRepoBySlug(repoSlug)) ?? githubRepo
  }

  // Awaiting-score repos are not in Redis yet — still promo-eligible from GitHub activity.
  if (!repo) {
    if (!githubRepo && !activity) return null
    return repoToActivitySnapshot({
      scoredAt: null,
      lastCommitAt: activity?.lastCommitAt ?? null,
      pushedAt: githubRepo?.pushedAt ?? activity?.pushedAt ?? null,
      commits7d: activity?.commits7d ?? null,
      commits30d: activity?.commits30d ?? null,
      commitTimestamps: activity?.commitTimestamps ?? null,
      createdAt: githubRepo?.createdAt ?? null,
      adminNote: 'Unscored — visible because it was recently pushed on GitHub.',
    })
  }

  const unscored = isUnscoredRecent(repo)
  return repoToActivitySnapshot({
    // Ignore placeholder scoredAt on unscored cards so earn counts post-create commits.
    scoredAt: unscored ? null : repo.scoredAt,
    lastCommitAt: activity?.lastCommitAt ?? null,
    pushedAt: githubRepo?.pushedAt ?? activity?.pushedAt ?? null,
    commits7d: activity?.commits7d ?? null,
    commits30d: activity?.commits30d ?? null,
    commitTimestamps: activity?.commitTimestamps ?? null,
    createdAt: githubRepo?.createdAt ?? null,
    adminNote: repo.adminNote ?? (unscored ? 'Unscored — visible because it was recently pushed on GitHub.' : null),
    scoringContextVersion: repo.scoringContextVersion,
  })
}
