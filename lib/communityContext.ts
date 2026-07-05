import { randomUUID } from 'crypto'
import type { Redis } from '@upstash/redis'
import { getRedis } from '@/lib/redis'
import { getConsumerEconomicScore, getShippingLeverage } from '@/lib/economicGrade'
import type { Repo } from '@/lib/scores'
import {
  evaluateState,
  maskWallet,
  type CommunityContextPublic,
  type CommunityContextSubmission,
  type VoteDirection,
} from '@/lib/communityContextTypes'

const SUBMISSION_KEY = 'build-report:ctx:submission:'
const BY_REPO_KEY = 'build-report:ctx:by-repo:'
const VOTES_KEY = 'build-report:ctx:votes:'

function submissionKey(id: string) {
  return `${SUBMISSION_KEY}${id}`
}
function byRepoKey(slug: string) {
  return `${BY_REPO_KEY}${slug}`
}
function votesKey(id: string) {
  return `${VOTES_KEY}${id}`
}

/** Dark-launch flag: the whole feature is off unless explicitly enabled. */
export function isCommunityContextEnabled(): boolean {
  return process.env.COMMUNITY_CONTEXT_ENABLED === 'true'
}

/** Grade snapshot used as the "before" reference on a submission. */
export function economicLabelForRepo(repo: Repo | null | undefined): string | null {
  if (!repo) return null
  const sl = getShippingLeverage(repo)
  if (sl) return `${sl.letter} (${sl.pct}%) SL`
  const tm = getConsumerEconomicScore(repo)
  if (tm) return `${tm.letter} (${tm.pct}%)`
  return null
}

export function toPublic(
  s: CommunityContextSubmission,
  viewerVote: 'up' | 'down' | null = null,
): CommunityContextPublic {
  return {
    id: s.id,
    slug: s.slug,
    text: s.text,
    source: s.source,
    walletMasked: maskWallet(s.wallet),
    createdAt: s.createdAt,
    state: s.state,
    stateChangedAt: s.stateChangedAt,
    upvotes: s.upvotes,
    downvotes: s.downvotes,
    scoreAtSubmit: s.scoreAtSubmit,
    acceptedAt: s.acceptedAt ?? null,
    consumedByRescoreAt: s.consumedByRescoreAt ?? null,
    viewerVote,
  }
}

export async function createSubmission(params: {
  slug: string
  text: string
  source: string | null
  wallet: string
  burnTxHash: string
  repo: Repo | null
  client?: Redis
}): Promise<CommunityContextSubmission> {
  const r = params.client ?? getRedis()
  const now = new Date().toISOString()
  const submission: CommunityContextSubmission = {
    id: randomUUID(),
    slug: params.slug,
    text: params.text,
    source: params.source,
    wallet: params.wallet,
    burnTxHash: params.burnTxHash,
    createdAt: now,
    state: 'pending',
    stateChangedAt: now,
    upvotes: 0,
    downvotes: 0,
    scoreAtSubmit: {
      economicLabel: economicLabelForRepo(params.repo),
      builderIntegrity: params.repo?.builderIntegrity?.letter ?? '—',
    },
    acceptedAt: null,
    consumedByRescoreAt: null,
  }

  await r.set(submissionKey(submission.id), submission)
  await r.sadd(byRepoKey(params.slug), submission.id)
  return submission
}

export async function getSubmission(id: string): Promise<CommunityContextSubmission | null> {
  try {
    const r = getRedis()
    const raw = await r.get<CommunityContextSubmission>(submissionKey(id))
    return raw && typeof raw === 'object' && raw.id ? raw : null
  } catch {
    return null
  }
}

async function listSubmissionsForRepo(slug: string): Promise<CommunityContextSubmission[]> {
  const r = getRedis()
  const ids = await r.smembers(byRepoKey(slug))
  if (!ids.length) return []
  const keys = ids.map(submissionKey)
  const values = await r.mget<(CommunityContextSubmission | null)[]>(...keys)
  const out: CommunityContextSubmission[] = []
  for (const v of values) {
    if (v && typeof v === 'object' && v.id) out.push(v)
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Public projection for one repo, including the viewer's own vote where known. */
export async function getPublicContextForRepo(
  slug: string,
  viewerWallet?: string | null,
): Promise<CommunityContextPublic[]> {
  try {
    const submissions = await listSubmissionsForRepo(slug)
    const visible = submissions.filter(s => s.state !== 'removed')
    if (!viewerWallet) return visible.map(s => toPublic(s))

    const r = getRedis()
    const lower = viewerWallet.toLowerCase()
    const votes = await Promise.all(
      visible.map(s => r.hget<VoteDirection>(votesKey(s.id), lower).catch(() => null)),
    )
    return visible.map((s, i) => toPublic(s, votes[i] === 'up' || votes[i] === 'down' ? votes[i] : null))
  } catch {
    return []
  }
}

/** Accepted context the AI reads on the next paid rescore. */
export async function getAcceptedContextForRepo(
  slug: string,
): Promise<CommunityContextSubmission[]> {
  try {
    const submissions = await listSubmissionsForRepo(slug)
    return submissions
      .filter(s => s.state === 'accepted')
      .sort((a, b) => (a.acceptedAt ?? '').localeCompare(b.acceptedAt ?? ''))
  } catch {
    return []
  }
}

/** Accepted context formatted as a prompt block, or undefined when there is none. */
export async function formatAcceptedCommunityContext(slug: string): Promise<string | undefined> {
  if (!isCommunityContextEnabled()) return undefined
  const accepted = await getAcceptedContextForRepo(slug)
  if (!accepted.length) return undefined
  return accepted
    .map(s => `- ${s.text} [source: ${s.source?.trim() || 'none provided'}]`)
    .join('\n')
}

/** Record/replace a wallet's vote, recompute tallies, and re-run the state machine. */
export async function recordVote(
  id: string,
  wallet: string,
  direction: VoteDirection,
): Promise<CommunityContextSubmission | null> {
  const r = getRedis()
  const submission = await getSubmission(id)
  if (!submission || submission.state === 'removed') return null

  await r.hset(votesKey(id), { [wallet.toLowerCase()]: direction })

  const voteMap = (await r.hgetall<Record<string, string>>(votesKey(id))) ?? {}
  let upvotes = 0
  let downvotes = 0
  for (const v of Object.values(voteMap)) {
    if (v === 'up') upvotes++
    else if (v === 'down') downvotes++
  }

  const nextState = evaluateState(upvotes, downvotes, submission.state)
  const stateChanged = nextState !== submission.state
  const now = new Date().toISOString()

  const updated: CommunityContextSubmission = {
    ...submission,
    upvotes,
    downvotes,
    state: nextState,
    stateChangedAt: stateChanged ? now : submission.stateChangedAt,
    acceptedAt:
      nextState === 'accepted'
        ? submission.acceptedAt ?? now
        : submission.acceptedAt ?? null,
  }

  await r.set(submissionKey(id), updated)
  return updated
}

/** Mark accepted-but-unconsumed entries as read by a rescore (records the "after" link). */
export async function markAcceptedConsumed(slug: string, at: string): Promise<void> {
  try {
    const r = getRedis()
    const accepted = await getAcceptedContextForRepo(slug)
    await Promise.all(
      accepted
        .filter(s => !s.consumedByRescoreAt)
        .map(s => r.set(submissionKey(s.id), { ...s, consumedByRescoreAt: at })),
    )
  } catch {
    // best-effort; consumption marker is informational
  }
}

/** Admin kill-switch — force-remove any submission (terminal, logged by caller). */
export async function adminRemoveSubmission(id: string): Promise<boolean> {
  const r = getRedis()
  const submission = await getSubmission(id)
  if (!submission) return false
  const now = new Date().toISOString()
  await r.set(submissionKey(id), {
    ...submission,
    state: 'removed',
    stateChangedAt: now,
  })
  return true
}

/**
 * Admin fast-track — force-accept a submission so the loop can close during the
 * quiet launch phase before there are enough voters. Terminal, logged by caller.
 */
export async function adminAcceptSubmission(id: string): Promise<boolean> {
  const r = getRedis()
  const submission = await getSubmission(id)
  if (!submission || submission.state === 'removed') return false
  const now = new Date().toISOString()
  await r.set(submissionKey(id), {
    ...submission,
    state: 'accepted',
    stateChangedAt: now,
    acceptedAt: submission.acceptedAt ?? now,
  })
  return true
}
