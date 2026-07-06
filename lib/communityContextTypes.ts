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

/** Compact per-repo indicator for the collapsed card + filter. */
export interface RepoContextSummary {
  state: 'accepted' | 'pending'
  /** Upvotes on the accepted item, or the leading pending item. */
  upvotes: number
  /** Votes needed to accept (for the "X/N" progress pill). */
  needed: number
}

export const TEXT_MAX = 500
export const SOURCE_MAX = 200
export const NO_SOURCE_LABEL = 'No source provided'

/**
 * Community-power thresholds. Launch-friendly defaults (2 votes, net +1) let the
 * submit -> vote -> accept -> rescore loop close with a small crowd, so context can
 * be the rescore incentive from day one. Raise these via env as the holder base grows.
 */
export interface VoteThresholds {
  voteTotalMin: number
  acceptNetMin: number
  acceptRatio: number
  rejectNetMax: number
}

export const DEFAULT_VOTE_THRESHOLDS: VoteThresholds = {
  voteTotalMin: 2,
  acceptNetMin: 1,
  acceptRatio: 0.6,
  rejectNetMax: -3,
}

function envNum(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw == null || raw.trim() === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export function getVoteThresholds(): VoteThresholds {
  return {
    voteTotalMin: envNum('COMMUNITY_CONTEXT_MIN_VOTES', DEFAULT_VOTE_THRESHOLDS.voteTotalMin),
    acceptNetMin: envNum('COMMUNITY_CONTEXT_ACCEPT_NET', DEFAULT_VOTE_THRESHOLDS.acceptNetMin),
    acceptRatio: envNum('COMMUNITY_CONTEXT_ACCEPT_RATIO', DEFAULT_VOTE_THRESHOLDS.acceptRatio),
    rejectNetMax: envNum('COMMUNITY_CONTEXT_REJECT_NET', DEFAULT_VOTE_THRESHOLDS.rejectNetMax),
  }
}

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
  // 'removed' (admin) and 'accepted' (community or admin) are sticky — a later
  // downvote swing should not silently un-accept context the AI may have read.
  if (current === 'removed') return 'removed'
  if (current === 'accepted') return 'accepted'

  const { voteTotalMin, acceptNetMin, acceptRatio, rejectNetMax } = getVoteThresholds()
  const total = upvotes + downvotes
  const net = upvotes - downvotes

  if (total >= voteTotalMin && net >= acceptNetMin && upvotes / total >= acceptRatio) {
    return 'accepted'
  }
  if (total >= voteTotalMin && net <= rejectNetMax) {
    return 'rejected'
  }
  return 'pending'
}

/** Message a wallet signs to cast a free vote (proves address control). */
export function voteMessage(submissionId: string, direction: VoteDirection): string {
  return `The Build Report — community context vote\nsubmission: ${submissionId}\nvote: ${direction}`
}
