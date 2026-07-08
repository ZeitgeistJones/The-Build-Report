import { NextRequest, NextResponse } from 'next/server'
import { guardDebugRoute } from '@/lib/debugAuth'
import { resolveRepoBeforeRescore } from '@/lib/autoscore'
import { loadGitHubStatsForPage } from '@/lib/githubStatsSnapshot'
import { countCommitsSinceScore } from '@/lib/commitsSinceScore'
import {
  buildPromoQuote,
  computeStaleCommitCount,
  repoToActivitySnapshot,
  resolvePromoActivitySnapshot,
} from '@/lib/rescorePromo'
import { getTreasuryBalanceEth } from '@/lib/rescorePromoTreasury'

export const dynamic = 'force-dynamic'

const SAMPLE_SLUGS = [
  'slop-circle',
  'slop-computer-live',
  'clawd-harness',
  'clawd-clipper',
  'private-voting',
]

async function diagnoseSlug(slug: string, treasuryBalanceEth: number | null) {
  const [cachedRepo, mergedActivity] = await Promise.all([
    resolveRepoBeforeRescore(slug),
    resolvePromoActivitySnapshot(slug),
  ])

  const cachedOnly = cachedRepo ? repoToActivitySnapshot(cachedRepo) : null
  const cachedStale = cachedOnly ? computeStaleCommitCount(cachedOnly) : 0
  const liveStale = mergedActivity ? computeStaleCommitCount(mergedActivity) : 0
  const sinceScore = mergedActivity
    ? countCommitsSinceScore(
        mergedActivity.scoredAt,
        mergedActivity.commitTimestamps,
        {
          lastCommitAt: mergedActivity.lastCommitAt,
          pushedAt: mergedActivity.pushedAt,
        },
      )
    : null

  const quote = mergedActivity
    ? await buildPromoQuote(mergedActivity, treasuryBalanceEth)
    : null

  return {
    slug,
    scoredAt: mergedActivity?.scoredAt ?? null,
    commitTimestampsCount: mergedActivity?.commitTimestamps?.length ?? 0,
    sinceScore,
    cachedStaleCommits: cachedStale,
    liveStaleCommits: liveStale,
    promoMismatch: cachedStale !== liveStale,
    promoEligible: quote?.eligible ?? false,
    promoReason: quote?.reason ?? null,
    buttonLabel: quote?.buttonLabel ?? null,
    rewardEth: quote?.rewardEth ?? 0,
  }
}

/** Compare card-style commit counts vs promo eligibility. Use ?key=CRON_SECRET&slug=optional */
export async function GET(req: NextRequest) {
  const denied = guardDebugRoute(req)
  if (denied) return denied

  const slugParam = req.nextUrl.searchParams.get('slug')?.trim()
  const treasuryBalanceEth = await getTreasuryBalanceEth()
  const slugs = slugParam ? [slugParam] : SAMPLE_SLUGS

  const repos = await Promise.all(slugs.map(slug => diagnoseSlug(slug, treasuryBalanceEth)))
  const mismatches = repos.filter(r => r.promoMismatch)

  const { stats, source } = await loadGitHubStatsForPage()

  return NextResponse.json({
    statsSource: source,
    treasuryBalanceEth,
    mismatchCount: mismatches.length,
    repos,
    note:
      'promoMismatch=true means promo used to ignore live GitHub commits (card vs promo bug). liveStaleCommits should match sinceScore.count when exact.',
  })
}
