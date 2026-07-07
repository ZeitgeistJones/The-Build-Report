/** Shown when rescore ETH is waiting in the receiver contract before execute(). */
export const APPROX_PENDING_LABEL = '≈ burn pending'

export const ETH_PENDING_TOOLTIP =
  'Rescore payments deposit ETH into the receiver contract. Anyone can call execute() on Base to swap it for CLAWD and send to dead.'

export const NOTHING_PENDING_TOOLTIP =
  'No ETH is waiting in the receiver right now. Your rescore fee may already have been swapped, or the CLAWD total updates after execute() confirms on-chain.'

export const CLAWD_BURNED_TOOLTIP =
  'Cumulative CLAWD sent to dead from execute() on the receiver contract — counted on-chain via Blockscout.'

export const RESCORE_COUNT_TOOLTIP =
  'Paid rescores that funded ETH into the receiver. CLAWD burned only increases after someone calls execute().'

/** Combined tooltip for the burn tracker stat card headline. */
export const BURN_TRACKER_TOOLTIP = [
  CLAWD_BURNED_TOOLTIP,
  RESCORE_COUNT_TOOLTIP,
  ETH_PENDING_TOOLTIP,
].join(' ')

/** Compact label for pending ETH in the header burn tracker. */
export function formatEthPendingLabel(ethPending: number): string {
  if (ethPending <= 0) return ''
  const trimmed =
    ethPending < 0.0001
      ? ethPending.toFixed(8).replace(/\.?0+$/, '')
      : ethPending.toFixed(6).replace(/\.?0+$/, '')
  return `~${trimmed} ETH queued`
}
