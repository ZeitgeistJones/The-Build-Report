import { createPublicClient, defineChain, getAddress, http, isAddressEqual } from 'viem'
import {
  BASE_CHAIN_ID,
  CLAWD_GATE_ABI,
  CLAWD_GATE_ADDRESS,
  CLAWD_GATE_TIER,
  RECEIVER_BUY_AND_BURN,
  SCORE_PAYMENT_WEI,
} from './constants'

const base = defineChain({
  id: BASE_CHAIN_ID,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
})

export async function verifyPaymentTx(txHash: string, walletAddress: string): Promise<void> {
  const hash = txHash as `0x${string}`
  const client = createPublicClient({
    chain: base,
    transport: http(),
  })

  const receipt = await client.getTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error('Transaction was not successful')
  }

  const block = await client.getBlock({ blockNumber: receipt.blockNumber })
  const txAgeSeconds = Number(BigInt(Math.floor(Date.now() / 1000)) - block.timestamp)
  if (txAgeSeconds > 3600) {
    throw new Error('Transaction is too old — must be used within 1 hour')
  }

  const tx = await client.getTransaction({ hash })
  const from = getAddress(tx.from)
  const expectedFrom = getAddress(walletAddress)
  if (!isAddressEqual(from, expectedFrom)) {
    throw new Error('Transaction sender does not match wallet')
  }

  if (!tx.to || !isAddressEqual(getAddress(tx.to), getAddress(RECEIVER_BUY_AND_BURN))) {
    throw new Error('Transaction was not sent to the receiver-buy-and-burn contract')
  }

  if (tx.value !== SCORE_PAYMENT_WEI) {
    throw new Error('Incorrect payment amount')
  }

  const hasAccess = await client.readContract({
    address: CLAWD_GATE_ADDRESS,
    abi: CLAWD_GATE_ABI,
    functionName: 'hasAccess',
    args: [getAddress(walletAddress), CLAWD_GATE_TIER],
  })
  if (!hasAccess) {
    throw new Error('Wallet does not meet CLAWDGate access requirements')
  }
}
