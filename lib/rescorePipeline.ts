/**
 * Shared free rescore pipeline — Admin + overnight cron.
 * Scores a repo, writes What changed, timeline, and returns meta for Needle.
 */

import { resolveRepoBeforeRescore, runAutoscoreSingle } from '@/lib/autoscore'
import { fetchRecentCommitMessages, fetchCommits30dCount, fetchRepoEvidence } from '@/lib/github'
import { bustOverallSummaryCache } from '@/lib/overallSummary'
import { generateRescoreChangeSummary } from '@/lib/rescoreChangeSummary'
import { buildRescoreSummaryRecord, saveRescoreSummary, type RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import { appendScoreHistory } from '@/lib/scoreHistory'
import { isCommunityContextEnabled, markAcceptedConsumed } from '@/lib/communityContext'
import { getRedis } from '@/lib/redis'
import { getShippingLeverage, getTokenMechanicForDisplay, showsEconomicNa } from '@/lib/economicGrade'
import { refreshNeedleAfterRescore } from '@/lib/needle'
import type { Repo } from '@/lib/scores'

export type RescorePipelineResult = {
  repo: Repo
  changeSummary: string | null
  rescoreMeta: RescoreSummaryRecord
}

export async function runRescorePipeline(repoSlug: string): Promise<RescorePipelineResult> {
  const redis = getRedis()
  const oldRepo = await resolveRepoBeforeRescore(repoSlug)
  const [commitMessages, commits30dAtRescore, evidence] = await Promise.all([
    fetchRecentCommitMessages(repoSlug),
    fetchCommits30dCount(repoSlug),
    fetchRepoEvidence(repoSlug, { fresh: true }),
  ])

  const repo = await runAutoscoreSingle(repoSlug)
  if (!repo) {
    throw new Error(
      'Could not score repo — AI returned an invalid score or GitHub evidence was unavailable. Try again.',
    )
  }

  const { summary: changeSummary, summaryNormie, deltaHeader } = await generateRescoreChangeSummary({
    oldRepo,
    newRepo: repo,
    commitMessages,
    evidence: evidence
      ? { rootFiles: evidence.rootFiles, readmeExcerpt: evidence.readmeExcerpt }
      : null,
  })

  const rescoreMeta = buildRescoreSummaryRecord({
    oldRepo,
    newRepo: repo,
    summary: changeSummary,
    summaryNormie,
    deltaHeader,
    commits30dAtRescore,
  })
  await saveRescoreSummary(repoSlug, rescoreMeta, redis)

  const economicScore = showsEconomicNa(repo)
    ? getShippingLeverage(repo)
    : getTokenMechanicForDisplay(repo)

  await appendScoreHistory(
    repoSlug,
    {
      scoredAt: repo.scoredAt ?? new Date().toISOString(),
      builderIntegrityLetter: repo.builderIntegrity.letter,
      builderIntegrityPct: repo.builderIntegrity.pct,
      economicLetter: economicScore?.letter ?? null,
      economicPct: economicScore?.pct ?? null,
      economicLabel: showsEconomicNa(repo) ? 'shipping leverage' : 'holder economics',
    },
    redis,
  )

  await bustOverallSummaryCache(redis)
  if (isCommunityContextEnabled()) {
    await markAcceptedConsumed(repoSlug, new Date().toISOString())
  }

  return { repo, changeSummary, rescoreMeta }
}

/** Fire-and-forget Needle refresh after a single rescore. */
export function scheduleNeedleRefreshAfterRescore(): void {
  refreshNeedleAfterRescore()
}
