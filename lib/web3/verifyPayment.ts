import { createPublicClient, getAddress, http, isAddressEqual } from 'viem'
import { base } from 'viem/chains'
import { RECEIVER_BUY_AND_BURN, SCORE_PAYMENT_WEI } from './constants'

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
}
