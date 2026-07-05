export type ContextState = 'pending' | 'accepted' | 'rejected' | 'removed'

export interface CommunityContextSubmission {
  id: string
  slug: string
  text: string
  source: string | null
  /** Full submitter address — kept for audit, never sent to the client. */
  wallet: string
  burnTxHash: string
  createdAt: string
  state: ContextState
  stateChangedAt: string
  upvotes: number
  downvotes: number
  /** Snapshot of the repo grade when this context was submitted (the "before"). */
  scoreAtSubmit: { economicLabel: string | null; builderIntegrity: string }
  acceptedAt?: string | null
  /** Set when a paid rescore first read this accepted context (links to the "after"). */
  consumedByRescoreAt?: string | null
}

/** Client-safe projection — no raw wallet, optional viewer's own vote. */
export interface CommunityContextPublic {
  id: string
  slug: string
  text: string
  source: string | null
  walletMasked: string
  createdAt: string
  state: ContextState
  stateChangedAt: string
  upvotes: number
  downvotes: number
  scoreAtSubmit: { economicLabel: string | null; builderIntegrity: string }
  acceptedAt?: string | null
  consumedByRescoreAt?: string | null
  viewerVote?: 'up' | 'down' | null
}

export type VoteDirection = 'up' | 'down'

/** Tunable community-power thresholds. */
export const TEXT_MAX = 500
export const SOURCE_MAX = 200
export const VOTE_TOTAL_MIN = 5
export const ACCEPT_NET_MIN = 3
export const ACCEPT_RATIO = 0.6
export const REJECT_NET_MAX = -3
export const NO_SOURCE_LABEL = 'No source provided'

export function maskWallet(addr: string): string {
  const a = addr.trim()
  if (a.length < 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

/**
 * Community-driven state machine. Votes alone decide accept/reject; `removed`
 * (admin kill-switch) is terminal and never re-evaluated.
 */
export function evaluateState(
  upvotes: number,
  downvotes: number,
  current: ContextState,
): ContextState {
  if (current === 'removed') return 'removed'

  const total = upvotes + downvotes
  const net = upvotes - downvotes

  if (total >= VOTE_TOTAL_MIN && net >= ACCEPT_NET_MIN && upvotes / total >= ACCEPT_RATIO) {
    return 'accepted'
  }
  if (total >= VOTE_TOTAL_MIN && net <= REJECT_NET_MAX) {
    return 'rejected'
  }
  return 'pending'
}

/** Message a wallet signs to cast a free vote (proves address control). */
export function voteMessage(submissionId: string, direction: VoteDirection): string {
  return `The Build Report — community context vote\nsubmission: ${submissionId}\nvote: ${direction}`
}
