import { FALLBACK_ETH_USD, fallbackEthUsdRate } from '@/lib/ethUsdRate'

/** Sync fallback for client render before provider hydrates. */
export function getEthUsdRate(): number {
  return fallbackEthUsdRate()
}

/** Human-friendly ~$0.01 style label from an ETH amount (promo rewards). */
export function formatApproxUsdFromEth(eth: number, rate = getEthUsdRate()): string {
  if (!Number.isFinite(eth) || eth <= 0) return '~$0'
  const usd = eth * rate
  if (usd < 0.005) return '~$0.01'
  if (usd < 10_000) {
    const rounded = Math.round(usd * 100) / 100
    return `~$${rounded.toFixed(2)}`
  }
  return `~$${Math.round(usd).toLocaleString('en-US')}`
}

export function formatRescorePriceLabel(eth: number, rate?: number): string {
  return formatApproxUsdFromEth(eth, rate)
}

export function formatPerCommitRewardUsd(walletRewardEth: number, rate?: number): string {
  return `${formatApproxUsdFromEth(walletRewardEth, rate)} per stale commit`
}
