'use client'

import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { injected } from '@wagmi/core'

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [injected()],
  transports: { [base.id]: http() },
})
