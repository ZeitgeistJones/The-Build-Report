import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from '@/lib/redis'
import { verifyWalletSignature, walletHasGateAccess } from '@/lib/web3/verifyPayment'
import {
  getSubmission,
  isCommunityContextEnabled,
  recordVote,
  toPublic,
} from '@/lib/communityContext'
import { voteMessage, type VoteDirection } from '@/lib/communityContextTypes'

export const maxDuration = 30

const ratelimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  prefix: 'build-report:rl:ctx-vote',
})

export async function POST(req: NextRequest) {
  if (!isCommunityContextEnabled()) {
    return NextResponse.json({ ok: false, error: 'Community context is not enabled' }, { status: 404 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''
    const signature = typeof body.signature === 'string' ? body.signature.trim() : ''
    const direction: VoteDirection | '' =
      body.direction === 'up' || body.direction === 'down' ? body.direction : ''

    if (!submissionId || !walletAddress || !signature || !direction) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    const submission = await getSubmission(submissionId)
    if (!submission || submission.state === 'removed') {
      return NextResponse.json({ ok: false, error: 'Submission not found' }, { status: 404 })
    }

    const validSig = await verifyWalletSignature(
      walletAddress,
      voteMessage(submissionId, direction),
      signature,
    )
    if (!validSig) {
      return NextResponse.json({ ok: false, error: 'Signature did not match wallet' }, { status: 401 })
    }

    const hasAccess = await walletHasGateAccess(walletAddress)
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'Wallet does not meet CLAWDGate access requirements' }, { status: 403 })
    }

    const { success } = await ratelimit.limit(walletAddress.toLowerCase())
    if (!success) {
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded — max 30 votes per hour per wallet' }, { status: 429 })
    }

    const updated = await recordVote(submissionId, walletAddress, direction)
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Could not record vote' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, submission: toPublic(updated, direction) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
