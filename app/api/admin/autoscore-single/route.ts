import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { resolveRepoBeforeRescore, runAutoscoreSingle } from '@/lib/autoscore'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { isRepoExcluded } from '@/lib/repoExclude'
import { fetchRecentCommitMessages, fetchCommits30dCount } from '@/lib/github'
import { bustOverallSummaryCache } from '@/lib/overallSummary'
import { recordRescoreBurn } from '@/lib/rescoreBurns'
import { generateRescoreChangeSummary } from '@/lib/rescoreChangeSummary'
import { buildRescoreSummaryRecord, saveRescoreSummary } from '@/lib/rescoreSummaries'
import { PAID_TX_KEY_PREFIX } from '@/lib/web3/constants'
import { verifyPaymentTx } from '@/lib/web3/verifyPayment'

export const maxDuration = 60

function getRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

export async function POST(req: NextRequest) {
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

    const redis = getRedis()
    const paidKey = `${PAID_TX_KEY_PREFIX}${txHash}`
    const alreadyUsed = await redis.get(paidKey)
    if (alreadyUsed) {
      return NextResponse.json({ ok: false, error: 'Transaction already used' }, { status: 400 })
    }

    await verifyPaymentTx(txHash, walletAddress)

    const oldRepo = await resolveRepoBeforeRescore(repoSlug)
    const [commitMessages, commits30dAtRescore] = await Promise.all([
      fetchRecentCommitMessages(repoSlug),
      fetchCommits30dCount(repoSlug),
    ])

    const repo = await runAutoscoreSingle(repoSlug)
    if (!repo) {
      return NextResponse.json({ ok: false, error: 'Could not score repo' }, { status: 500 })
    }

    const changeSummary = await generateRescoreChangeSummary({
      oldRepo,
      newRepo: repo,
      commitMessages,
    })

    const rescoreMeta = buildRescoreSummaryRecord({
      oldRepo,
      newRepo: repo,
      summary: changeSummary,
      commits30dAtRescore,
    })
    await saveRescoreSummary(repoSlug, rescoreMeta, redis)

    await redis.set(paidKey, repoSlug, { ex: 60 * 60 * 24 * 7 })
    await bustOverallSummaryCache(redis)
    await recordRescoreBurn(redis)

    return NextResponse.json({ ok: true, repo, changeSummary, rescoreMeta })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
