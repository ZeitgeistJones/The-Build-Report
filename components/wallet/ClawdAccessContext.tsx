'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
} from 'wagmi'
import { injected } from 'wagmi/connectors'
import { base } from 'wagmi/chains'
import {
  CLAWD_GATE_ABI,
  CLAWD_GATE_ADDRESS,
  CLAWD_GATE_TIER,
} from '@/lib/web3/constants'

interface ClawdAccessContextValue {
  isConnected: boolean
  address: `0x${string}` | undefined
  hasAccess: boolean
  unlocked: boolean
  isLoading: boolean
  isWrongChain: boolean
  connectWallet: () => void
  disconnectWallet: () => void
  switchToBase: () => void
  refetchAccess: () => void
}

const ClawdAccessContext = createContext<ClawdAccessContextValue | null>(null)

export function ClawdAccessProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount()
  const { connect, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const isWrongChain = isConnected && chainId !== base.id

  const { data: hasAccessRaw, isLoading: isAccessLoading, refetch } = useReadContract({
    address: CLAWD_GATE_ADDRESS,
    abi: CLAWD_GATE_ABI,
    functionName: 'hasAccess',
    args: address && !isWrongChain ? [address, CLAWD_GATE_TIER] : undefined,
    chainId: base.id,
    query: { enabled: !!address && !isWrongChain },
  })

  const hasAccess = !!hasAccessRaw
  const unlocked = isConnected && !isWrongChain && hasAccess

  const connectWallet = useCallback(() => {
    connect({ connector: injected(), chainId: base.id })
  }, [connect])

  const disconnectWallet = useCallback(() => {
    disconnect()
  }, [disconnect])

  const switchToBase = useCallback(() => {
    switchChain({ chainId: base.id })
  }, [switchChain])

  const value = useMemo<ClawdAccessContextValue>(
    () => ({
      isConnected,
      address,
      hasAccess,
      unlocked,
      isLoading: isConnecting || isSwitching || isAccessLoading,
      isWrongChain,
      connectWallet,
      disconnectWallet,
      switchToBase,
      refetchAccess: () => {
        void refetch()
      },
    }),
    [
      isConnected,
      address,
      hasAccess,
      unlocked,
      isConnecting,
      isSwitching,
      isAccessLoading,
      isWrongChain,
      connectWallet,
      disconnectWallet,
      switchToBase,
      refetch,
    ],
  )

  return (
    <ClawdAccessContext.Provider value={value}>
      {children}
    </ClawdAccessContext.Provider>
  )
}

export function useClawdAccess(): ClawdAccessContextValue {
  const ctx = useContext(ClawdAccessContext)
  if (!ctx) {
    throw new Error('useClawdAccess must be used within ClawdAccessProvider')
  }
  return ctx
}
