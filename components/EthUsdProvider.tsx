'use client'

import { createContext, useContext } from 'react'
import { FALLBACK_ETH_USD } from '@/lib/ethUsdRate'

const EthUsdContext = createContext(FALLBACK_ETH_USD)

export function EthUsdProvider({
  rate,
  children,
}: {
  rate: number
  children: React.ReactNode
}) {
  return <EthUsdContext.Provider value={rate}>{children}</EthUsdContext.Provider>
}

export function useEthUsdRate(): number {
  return useContext(EthUsdContext)
}
