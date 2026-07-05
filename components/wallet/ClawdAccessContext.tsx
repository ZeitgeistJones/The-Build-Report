'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
} from 'wagmi'
import { base } from 'wagmi/chains'
import {
  CLAWD_GATE_ABI,
  CLAWD_GATE_ADDRESS,
  CLAWD_GATE_TIER,
} from '@/lib/web3/constants'

// #region agent log
function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
) {
  const payload = {
    sessionId: '8818b3',
    location,
    message,
    data: {
      ...data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
    timestamp: Date.now(),
    hypothesisId,
    runId: 'pre-fix',
  }
  fetch('/api/wallet-debug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
// #endregion

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
  const { connect, connectors, isPending: isConnecting, error: connectError, status: connectStatus } = useConnect({
    mutation: {
      onSuccess: data => {
        // #region agent log
        debugLog('ClawdAccessContext.tsx:connect:onSuccess', 'Connect mutation succeeded', {
          accounts: data.accounts?.map(a => `${a.slice(0, 6)}…${a.slice(-4)}`),
          chainId: data.chainId,
        }, 'H3')
        // #endregion
      },
      onError: error => {
        // #region agent log
        debugLog('ClawdAccessContext.tsx:connect:onError', 'Connect mutation failed', {
          errorName: error.name,
          errorMessage: error.message,
        }, 'H2')
        // #endregion
      },
    },
  })
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()

  const isWrongChain = isConnected && chainId !== base.id

  const { data: hasAccessRaw, isLoading: isAccessLoading, isError: isAccessError, error: accessError, refetch } = useReadContract({
    address: CLAWD_GATE_ADDRESS,
    abi: CLAWD_GATE_ABI,
    functionName: 'hasAccess',
    args: address && !isWrongChain ? [address, CLAWD_GATE_TIER] : undefined,
    chainId: base.id,
    query: { enabled: !!address && !isWrongChain },
  })

  // #region agent log
  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as Window & { ethereum?: unknown }) : undefined
    debugLog('ClawdAccessContext.tsx:mount', 'Wallet environment on load', {
      hasWindowEthereum: !!win?.ethereum,
      connectorCount: connectors.length,
      connectorIds: connectors.map(c => c.id),
    }, 'H1')
  }, [connectors])

  useEffect(() => {
    if (!connectError) return
    debugLog('ClawdAccessContext.tsx:connectError', 'Connect error state updated', {
      errorName: connectError.name,
      errorMessage: connectError.message,
      connectStatus,
    }, 'H2')
  }, [connectError, connectStatus])

  useEffect(() => {
    debugLog('ClawdAccessContext.tsx:account', 'Account state changed', {
      isConnected,
      chainId,
      isWrongChain,
      connectStatus,
      isConnecting,
    }, 'H4')
  }, [isConnected, chainId, isWrongChain, connectStatus, isConnecting])

  useEffect(() => {
    if (!isConnected || isWrongChain || !address) return
    debugLog('ClawdAccessContext.tsx:access', 'Access check state', {
      isAccessLoading,
      isAccessError,
      hasAccess: !!hasAccessRaw,
      accessErrorMessage: accessError?.message,
    }, 'H5')
  }, [isConnected, isWrongChain, address, isAccessLoading, isAccessError, hasAccessRaw, accessError])

  useEffect(() => {
    if (!switchError) return
    debugLog('ClawdAccessContext.tsx:switchError', 'Switch chain failed', {
      errorName: switchError.name,
      errorMessage: switchError.message,
    }, 'H4')
  }, [switchError])
  // #endregion

  const hasAccess = !!hasAccessRaw
  const unlocked = isConnected && !isWrongChain && hasAccess

  const connectWallet = useCallback(() => {
    const connector = connectors[0]
    // #region agent log
    debugLog('ClawdAccessContext.tsx:connectWallet', 'Connect wallet clicked', {
      connectorPresent: !!connector,
      connectorId: connector?.id,
      connectorCount: connectors.length,
      targetChainId: base.id,
      alreadyConnected: isConnected,
      currentChainId: chainId,
    }, 'H1')
    // #endregion
    if (connector) connect({ connector, chainId: base.id })
  }, [connect, connectors, isConnected, chainId])

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
