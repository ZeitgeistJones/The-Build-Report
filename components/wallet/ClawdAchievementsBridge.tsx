'use client'

import { useEffect } from 'react'
import { useAccount } from 'wagmi'

declare global {
  interface Window {
    ClawdAchievements?: {
      check: (walletAddress: string) => void
    }
  }
}

/** Polls the Achievement Hub embed for pending badges when a wallet connects. */
export default function ClawdAchievementsBridge() {
  const { address } = useAccount()

  useEffect(() => {
    if (!address) return
    window.ClawdAchievements?.check(address)
  }, [address])

  return null
}
