/** Approximate ETH/USD for promo reward labels only — not a live price feed. */
const DEFAULT_ETH_USD = 2500

export function getEthUsdRate(): number {
  const raw =
    process.env.NEXT_PUBLIC_RESCORE_PROMO_ETH_USD?.trim() ??
    process.env.RESCORE_PROMO_ETH_USD?.trim()
  if (!raw) return DEFAULT_ETH_USD
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ETH_USD
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

export function formatPerCommitRewardUsd(pennyEth: number): string {
  return `${formatApproxUsdFromEth(pennyEth)} per stale commit`
}
