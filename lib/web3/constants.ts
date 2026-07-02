export const BASE_CHAIN_ID = 8453

export const CLAWD_GATE_ADDRESS = '0xc22B7b983EC81523c969753c2385106835E8CfCE' as const
export const CLAWD_GATE_TIER = 1

export const CLAWD_GATE_ABI = [
  {
    name: 'hasAccess',
    type: 'function',
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'tier', type: 'uint8' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
] as const

export const RECEIVER_BUY_AND_BURN = '0x0C1a3DB07304D2E4E551AB4A7b083382a33f25ad' as const
export const SCORE_PAYMENT_WEI = BigInt('8000000000000') // 0.000008 ETH

export const PAID_TX_KEY_PREFIX = 'build-report:paid-tx:'
