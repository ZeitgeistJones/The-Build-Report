/** Shown when rescore ETH is waiting in the receiver contract before execute(). */
export const APPROX_PENDING_LABEL = '≈ burn pending'

export const ETH_PENDING_TOOLTIP =
  'Rescore payments deposit ETH into the receiver contract. This is an approximate count of swaps waiting — not a wallet balance. Anyone can call execute() on Base to swap it for CLAWD and send to dead.'

export const CLAWD_BURNED_TOOLTIP =
  'Cumulative CLAWD sent to dead from execute() on the receiver contract — counted on-chain via Blockscout.'
