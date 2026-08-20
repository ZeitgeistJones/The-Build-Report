import {
  BRIEF_DATES_INDEX_KEY,
  mountainDateKeyDaysAgo,
  mountainDateKeysInclusive,
  indexArchiveDate,
  listIndexedDateKeys,
} from '@/lib/archiveIndex'
import {
  getCachedDigestForDate,
  toBuildBriefData,
  type BuildBriefData,
  type DailyDigestCache,
} from '@/lib/buildBrief'

export type ArchiveType = 'brief'
export type ArchivePeriod = '7d' | '30d' | '90d'

/** Type filter retired — Archives is Brief-only now. Kept for URL compat. */
export const ARCHIVE_TYPE_OPTIONS: { key: ArchiveType; label: string }[] = [
  { key: 'brief', label: 'Brief' },
]

export const ARCHIVE_PERIOD_OPTIONS: { key: ArchivePeriod; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
]

export type ArchiveFeedItem = {
  kind: 'brief'
  sortAt: string
  dateKey: string
  brief: BuildBriefData
}

function periodToDays(period: ArchivePeriod): number {
  if (period === '7d') return 7
  if (period === '30d') return 30
  return 90
}

function sinceDateKeyForPeriod(period: ArchivePeriod): string {
  return mountainDateKeyDaysAgo(periodToDays(period))
}

function digestHasRealCards(digest: DailyDigestCache): boolean {
  const c = digest.cards
  if (!c) return false
  const windows = [c['24h'], c['7d'], c['30d'], c['60d']] as const
  return windows.some(
    w => Boolean(w?.builder?.trim() || w?.economic?.trim() || w?.integrity?.trim() || w?.leverage?.trim()),
  )
}

function digestToBrief(digest: DailyDigestCache): BuildBriefData {
  const brief = toBuildBriefData(digest)
  return {
    ...brief,
    cards: digestHasRealCards(digest) ? digest.cards : null,
  }
}

async function loadBriefItems(sinceDateKey: string): Promise<ArchiveFeedItem[]> {
  const indexed = await listIndexedDateKeys(BRIEF_DATES_INDEX_KEY, sinceDateKey)
  const rangeKeys = mountainDateKeysInclusive(sinceDateKey)
  const dateKeys = [...new Set([...indexed, ...rangeKeys])].sort((a, b) => b.localeCompare(a))
  const indexedSet = new Set(indexed)

  const digests = await Promise.all(dateKeys.map(dateKey => getCachedDigestForDate(dateKey)))
  const items: ArchiveFeedItem[] = []
  const backfill: Promise<void>[] = []

  for (let i = 0; i < dateKeys.length; i++) {
    const dateKey = dateKeys[i]!
    const digest = digests[i]
    if (!digest) continue
    if (!indexedSet.has(dateKey)) {
      backfill.push(indexArchiveDate(BRIEF_DATES_INDEX_KEY, dateKey))
    }
    items.push({
      kind: 'brief',
      sortAt: digest.generatedAt || `${dateKey}T12:00:00.000Z`,
      dateKey,
      brief: digestToBrief(digest),
    })
  }

  if (backfill.length) await Promise.all(backfill)
  return items
}

export function parseArchiveType(_raw: string | string[] | undefined): ArchiveType {
  return 'brief'
}

export function parseArchivePeriod(raw: string | string[] | undefined): ArchivePeriod {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === '7d' || v === '30d' || v === '90d') return v
  return '30d'
}

export async function getArchiveFeed(opts: {
  type?: ArchiveType
  period?: ArchivePeriod
}): Promise<ArchiveFeedItem[]> {
  const period = opts.period ?? '30d'
  const sinceDateKey = sinceDateKeyForPeriod(period)
  const items = await loadBriefItems(sinceDateKey)
  return items.sort((a, b) => b.sortAt.localeCompare(a.sortAt))
}
