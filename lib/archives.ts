import {
  BRIEF_DATES_INDEX_KEY,
  NEEDLE_DATES_INDEX_KEY,
  mountainDateKeyDaysAgo,
  mountainDateKeysInclusive,
  indexArchiveDate,
  listIndexedDateKeys,
} from '@/lib/archiveIndex'
import {
  getCachedDigestForDate,
  type BuildBriefData,
  type DailyDigestCache,
} from '@/lib/buildBrief'
import { getCachedNeedleForDate, type NeedleData } from '@/lib/needle'

export type ArchiveType = 'all' | 'brief' | 'needle'
export type ArchivePeriod = '7d' | '30d' | '90d'

export const ARCHIVE_TYPE_OPTIONS: { key: ArchiveType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'brief', label: 'Brief' },
  { key: 'needle', label: 'Needle' },
]

export const ARCHIVE_PERIOD_OPTIONS: { key: ArchivePeriod; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
]

export type ArchiveFeedItem =
  | { kind: 'brief'; sortAt: string; dateKey: string; brief: BuildBriefData }
  | { kind: 'needle'; sortAt: string; dateKey: string; needle: NeedleData }

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
  // toBuildBriefData is not exported — mirror it locally
  return {
    text: digest.general,
    general: digest.general,
    ...(digest.generalNormie ? { generalNormie: digest.generalNormie } : {}),
    cards: digestHasRealCards(digest) ? digest.cards : null,
    dateKey: digest.dateKey,
    isToday: false,
    repoCount: digest.repoCount,
    commitCount: digest.commitCount,
    generatedAt: digest.generatedAt,
  }
}

async function loadBriefItems(sinceDateKey: string): Promise<ArchiveFeedItem[]> {
  // Probe every calendar day in range — the ZSET index was added later and is often sparse,
  // while digest payloads still live under build-report:daily-digest:{date} (90d TTL).
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

async function loadNeedleItems(sinceDateKey: string): Promise<ArchiveFeedItem[]> {
  const indexed = await listIndexedDateKeys(NEEDLE_DATES_INDEX_KEY, sinceDateKey)
  const rangeKeys = mountainDateKeysInclusive(sinceDateKey)
  const dateKeys = [...new Set([...indexed, ...rangeKeys])].sort((a, b) => b.localeCompare(a))
  const indexedSet = new Set(indexed)

  const needles = await Promise.all(dateKeys.map(dateKey => getCachedNeedleForDate(dateKey)))
  const items: ArchiveFeedItem[] = []
  const backfill: Promise<void>[] = []

  for (let i = 0; i < dateKeys.length; i++) {
    const dateKey = dateKeys[i]!
    const needle = needles[i]
    if (!needle) continue
    if (!indexedSet.has(dateKey)) {
      backfill.push(indexArchiveDate(NEEDLE_DATES_INDEX_KEY, dateKey))
    }
    items.push({
      kind: 'needle',
      sortAt: needle.generatedAt || `${dateKey}T12:00:00.000Z`,
      dateKey,
      needle,
    })
  }

  if (backfill.length) await Promise.all(backfill)
  return items
}

export function parseArchiveType(raw: string | string[] | undefined): ArchiveType {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'brief' || v === 'needle' || v === 'all') return v
  // Legacy ?type=spotted|overheard URLs fall back to All (Brief + Needle only).
  return 'all'
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
  const type = opts.type ?? 'all'
  const period = opts.period ?? '30d'
  const sinceDateKey = sinceDateKeyForPeriod(period)

  const loaders: Promise<ArchiveFeedItem[]>[] = []
  if (type === 'all' || type === 'brief') loaders.push(loadBriefItems(sinceDateKey))
  if (type === 'all' || type === 'needle') loaders.push(loadNeedleItems(sinceDateKey))

  const chunks = await Promise.all(loaders)
  return chunks
    .flat()
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
}
