import { Redis } from '@upstash/redis'
import { getRedis } from '@/lib/redis'
import { Repo, Score } from './scores'
import { getConsumerEconomicScore, getShippingLeverage } from './economicGrade'

function formatEconomicLabel(repo: Repo | null | undefined): string | null {
  if (!repo) return null
  const sl = getShippingLeverage(repo)
  if (sl) return `${sl.letter} (${sl.pct}%) SL`
  const tm = getConsumerEconomicScore(repo)
  if (tm) return `${tm.letter} (${tm.pct}%)`
  return null
}

const KEY_PREFIX = 'build-report:rescore-summary:'

export type RescoreSummaryRecord = {
  summary: string
  oldTokenMechanic: string | null
  newTokenMechanic: string | null
  oldBuilderIntegrity: string
  newBuilderIntegrity: string
  oldScoredAt: string | null
  newScoredAt: string
  commits30dAtRescore: number
  rescoreAt: string
}

function summaryKey(slug: string) {
  return `${KEY_PREFIX}${slug}`
}

export function formatScoreLabel(score: Score | null | undefined): string | null {
  if (!score) return null
  return `${score.letter} (${score.pct}%)`
}

export function buildRescoreSummaryRecord(params: {
  oldRepo: Repo | null
  newRepo: Repo
  summary: string | null
  commits30dAtRescore: number
}): RescoreSummaryRecord {
  const { oldRepo, newRepo, summary, commits30dAtRescore } = params
  return {
    summary: summary?.trim() ?? '',
    oldTokenMechanic: formatEconomicLabel(oldRepo),
    newTokenMechanic: formatEconomicLabel(newRepo),
    oldBuilderIntegrity: formatScoreLabel(oldRepo?.builderIntegrity) ?? '—',
    newBuilderIntegrity: formatScoreLabel(newRepo.builderIntegrity) ?? '—',
    oldScoredAt: oldRepo?.scoredAt ?? null,
    newScoredAt: newRepo.scoredAt,
    commits30dAtRescore,
    rescoreAt: new Date().toISOString(),
  }
}

export async function saveRescoreSummary(
  slug: string,
  record: RescoreSummaryRecord,
  client?: Redis,
): Promise<void> {
  const r = client ?? getRedis()
  await r.set(summaryKey(slug), record, { ex: 60 * 60 * 24 * 90 })
}

export async function getRescoreSummary(slug: string): Promise<RescoreSummaryRecord | null> {
  try {
    const r = getRedis()
    const raw = await r.get<RescoreSummaryRecord>(summaryKey(slug))
    return raw ?? null
  } catch {
    return null
  }
}

export async function getRescoreSummaries(
  slugs: string[],
): Promise<Record<string, RescoreSummaryRecord>> {
  if (!slugs.length) return {}
  try {
    const r = getRedis()
    const keys = slugs.map(summaryKey)
    const values = await r.mget<(RescoreSummaryRecord | null)[]>(...keys)
    const out: Record<string, RescoreSummaryRecord> = {}
    slugs.forEach((slug, i) => {
      const v = values[i]
      if (v && typeof v === 'object' && v.rescoreAt) out[slug] = v
    })
    return out
  } catch {
    return {}
  }
}
