import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { isRepoExcluded } from '@/lib/repoExclude'
import { resolveRepoBeforeRescore } from '@/lib/autoscore'
import { getRedis } from '@/lib/redis'
import { CONTEXT_SUBMIT_WEI, PAID_TX_KEY_PREFIX } from '@/lib/web3/constants'
import { verifyPaymentTx } from '@/lib/web3/verifyPayment'
import { createSubmission, isCommunityContextEnabled, toPublic } from '@/lib/communityContext'
import { SOURCE_MAX, TEXT_MAX } from '@/lib/communityContextTypes'

export const maxDuration = 30

const ratelimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'build-report:rl:ctx-submit',
})

export async function POST(req: NextRequest) {
  if (!isCommunityContextEnabled()) {
    return NextResponse.json({ ok: false, error: 'Community context is not enabled' }, { status: 404 })
  }

  const redis = getRedis()
  let paidKey: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const repoSlug = typeof body.repoSlug === 'string' ? body.repoSlug.trim() : ''
    const txHash = typeof body.txHash === 'string' ? body.txHash.trim() : ''
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const sourceRaw = typeof body.source === 'string' ? body.source.trim() : ''
    const source = sourceRaw || null

    if (!repoSlug || !txHash || !walletAddress || !text) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }
    if (text.length > TEXT_MAX) {
      return NextResponse.json({ ok: false, error: `Context must be ${TEXT_MAX} characters or fewer` }, { status: 400 })
    }
    if (source && source.length > SOURCE_MAX) {
      return NextResponse.json({ ok: false, error: `Source must be ${SOURCE_MAX} characters or fewer` }, { status: 400 })
    }
    if (shouldSkipRepo(repoSlug)) {
      return NextResponse.json({ ok: false, error: 'Repo not eligible' }, { status: 400 })
    }
    if (await isRepoExcluded(repoSlug)) {
      return NextResponse.json({ ok: false, error: 'Repo is excluded' }, { status: 400 })
    }

    paidKey = `${PAID_TX_KEY_PREFIX}${txHash}`
    const claimed = await redis.set(paidKey, 'pending', { nx: true })
    if (!claimed) {
      return NextResponse.json({ ok: false, error: 'Transaction already used or in progress' }, { status: 400 })
    }

    await verifyPaymentTx(txHash, walletAddress, CONTEXT_SUBMIT_WEI)

    const { success } = await ratelimit.limit(walletAddress.toLowerCase())
    if (!success) {
      await redis.del(paidKey)
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded — max 3 submissions per hour per wallet' }, { status: 429 })
    }

    const repo = await resolveRepoBeforeRescore(repoSlug)

    const submission = await createSubmission({
      slug: repoSlug,
      text,
      source,
      wallet: walletAddress,
      burnTxHash: txHash,
      repo,
      client: redis,
    })

    await redis.set(paidKey, `ctx:${submission.id}`)

    return NextResponse.json({ ok: true, submission: toPublic(submission) })
  } catch (err: unknown) {
    if (paidKey) {
      await redis.del(paidKey).catch(() => {})
    }
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
