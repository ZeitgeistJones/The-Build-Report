import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { resolveRepoBeforeRescore, runAutoscoreSingle } from '@/lib/autoscore'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { isRepoExcluded } from '@/lib/repoExclude'
import { fetchRecentCommitMessages, fetchCommits30dCount } from '@/lib/github'
import { bustOverallSummaryCache } from '@/lib/overallSummary'
import { recordRescoreBurn } from '@/lib/rescoreBurns'
import { generateRescoreChangeSummary } from '@/lib/rescoreChangeSummary'
import { buildRescoreSummaryRecord, saveRescoreSummary } from '@/lib/rescoreSummaries'
import { isCommunityContextEnabled, markAcceptedConsumed } from '@/lib/communityContext'
import { getRedis } from '@/lib/redis'
import { PAID_TX_KEY_PREFIX } from '@/lib/web3/constants'
import { verifyPaymentTx } from '@/lib/web3/verifyPayment'

export const maxDuration = 60

const ratelimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'build-report:rl:rescore',
})

export async function POST(req: NextRequest) {
  const redis = getRedis()
  let paidKey: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const repoSlug = typeof body.repoSlug === 'string' ? body.repoSlug.trim() : ''
    const txHash = typeof body.txHash === 'string' ? body.txHash.trim() : ''
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''

    if (!repoSlug || !txHash || !walletAddress) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    if (shouldSkipRepo(repoSlug)) {
      return NextResponse.json({ ok: false, error: 'Repo not eligible for scoring' }, { status: 400 })
    }

    if (await isRepoExcluded(repoSlug)) {
      return NextResponse.json({ ok: false, error: 'Repo is excluded from scoring' }, { status: 400 })
    }

    paidKey = `${PAID_TX_KEY_PREFIX}${txHash}`
    const claimed = await redis.set(paidKey, 'pending', { nx: true })
    if (!claimed) {
      return NextResponse.json(
        { ok: false, error: 'Transaction already used or in progress' },
        { status: 400 },
      )
    }

    await verifyPaymentTx(txHash, walletAddress)

    const { success } = await ratelimit.limit(walletAddress.toLowerCase())
    if (!success) {
      await redis.del(paidKey)
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded — max 3 rescores per hour per wallet' }, { status: 429 })
    }

    const oldRepo = await resolveRepoBeforeRescore(repoSlug)
    const [commitMessages, commits30dAtRescore] = await Promise.all([
      fetchRecentCommitMessages(repoSlug),
      fetchCommits30dCount(repoSlug),
    ])

    const repo = await runAutoscoreSingle(repoSlug)
    if (!repo) {
      await redis.del(paidKey)
      return NextResponse.json({ ok: false, error: 'Could not score repo' }, { status: 500 })
    }

    const { summary: changeSummary, deltaHeader } = await generateRescoreChangeSummary({
      oldRepo,
      newRepo: repo,
      commitMessages,
    })

    const rescoreMeta = buildRescoreSummaryRecord({
      oldRepo,
      newRepo: repo,
      summary: changeSummary,
      deltaHeader,
      commits30dAtRescore,
    })
    await saveRescoreSummary(repoSlug, rescoreMeta, redis)

    await redis.set(paidKey, `complete:${repoSlug}`)
    await bustOverallSummaryCache(redis)
    await recordRescoreBurn(redis)
    if (isCommunityContextEnabled()) {
      await markAcceptedConsumed(repoSlug, new Date().toISOString())
    }

    return NextResponse.json({ ok: true, repo, changeSummary, rescoreMeta })
  } catch (err: unknown) {
    if (paidKey) {
      await redis.del(paidKey).catch(() => {})
    }
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
