export const BASE_CHAIN_ID = 8453

export const CLAWD_GATE_ADDRESS = '0xc22B7b983EC81523c969753c2385106835E8CfCE' as const
export const CLAWD_GATE_TIER = 1

/**
 * When false: report is fully visible and Score/Rescore/promo skip CLAWDGate.
 * Community context votes still use walletHasGateAccess (on-chain check).
 * Flip to true to restore the blur + Score hold requirement.
 */
export const REPORT_TOKEN_GATE_ENABLED = false

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
/** Burn required to submit community context. Same amount as a rescore for now. */
export const CONTEXT_SUBMIT_WEI = SCORE_PAYMENT_WEI

/** Earliest Base block to scan for receiver Burned events (chunked getLogs). */
export const RECEIVER_BUY_AND_BURN_FROM_BLOCK = BigInt(47_000_000)

export const RECEIVER_BUY_AND_BURN_ABI = [
  {
    name: 'execute',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    // Emitted by execute() — amount is CLAWD sent to dead (param name varies by explorer).
    name: 'Burned',
    type: 'event',
    inputs: [{ name: 'amount', type: 'uint256', indexed: false }],
  },
] as const

export const CLAWD_TOKEN_ADDRESS = '0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07' as const
export const CLAWD_BUY_URL = 'https://token.clawdbotatg.eth.limo' as const

export const PAID_TX_KEY_PREFIX = 'build-report:paid-tx:'
