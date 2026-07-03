import { CLAWD_TOKEN_ADDRESS } from '@/lib/web3/constants'

export type EthClawdUsdPrices = {
  ethUsd: number
  clawdUsd: number
}

export async function getEthAndClawdUsdPrices(): Promise<EthClawdUsdPrices> {
  const clawdAddress = CLAWD_TOKEN_ADDRESS.toLowerCase()
  const [ethRes, clawdRes] = await Promise.all([
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      next: { revalidate: 60 },
    }),
    fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${clawdAddress}&vs_currencies=usd`,
      { next: { revalidate: 60 } },
    ),
  ])

  if (!ethRes.ok || !clawdRes.ok) {
    throw new Error('CoinGecko price fetch failed')
  }

  const ethJson = await ethRes.json()
  const clawdJson = await clawdRes.json()

  const ethUsd = ethJson?.ethereum?.usd
  const clawdUsd = clawdJson?.[clawdAddress]?.usd

  if (typeof ethUsd !== 'number' || typeof clawdUsd !== 'number' || clawdUsd <= 0) {
    throw new Error('CoinGecko returned invalid prices')
  }

  return { ethUsd, clawdUsd }
}
