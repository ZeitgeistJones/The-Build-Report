import { CLAWD_TOKEN_ADDRESS } from '@/lib/web3/constants'

export type EthClawdUsdPrices = {
  ethUsd: number
  clawdUsd: number
}

export async function getEthUsdPrice(): Promise<number> {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`CoinGecko ETH fetch failed: ${res.status}`)
  const json = await res.json()
  const ethUsd = json?.ethereum?.usd
  if (typeof ethUsd !== 'number' || ethUsd <= 0) throw new Error('CoinGecko returned invalid ETH price')
  return ethUsd
}

export async function getClawdUsdPrice(): Promise<number> {
  const clawdAddress = CLAWD_TOKEN_ADDRESS.toLowerCase()
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${clawdAddress}&vs_currencies=usd`,
    { cache: 'no-store' },
  )
  if (!res.ok) throw new Error(`CoinGecko CLAWD fetch failed: ${res.status}`)
  const json = await res.json()
  const clawdUsd = json?.[clawdAddress]?.usd
  if (typeof clawdUsd !== 'number' || clawdUsd <= 0) throw new Error('CoinGecko returned invalid CLAWD price')
  return clawdUsd
}

export async function getEthAndClawdUsdPrices(): Promise<EthClawdUsdPrices> {
  const [ethUsd, clawdUsd] = await Promise.all([getEthUsdPrice(), getClawdUsdPrice()])
  return { ethUsd, clawdUsd }
}
