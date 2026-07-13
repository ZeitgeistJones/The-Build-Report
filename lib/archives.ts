import {
  BRIEF_DATES_INDEX_KEY,
  NEEDLE_DATES_INDEX_KEY,
  mountainDateKeyDaysAgo,
  indexArchiveDate,
  listIndexedDateKeys,
} from '@/lib/archiveIndex'
import {
  buildBriefEditionKeys,
  getCachedDigestForDate,
  type BuildBriefData,
  type DailyDigestCache,
} from '@/lib/buildBrief'
import { getCachedNeedleForDate, type NeedleData } from '@/lib/needle'
import { listPublishedSpotted, type SpottedEntry } from '@/lib/spotted'
import { listPublishedMentionsSince, type OverheardEntry } from '@/lib/podcastMentions'

export type ArchiveType = 'all' | 'brief' | 'needle' | 'spotted' | 'overheard'
export type ArchivePeriod = '7d' | '30d' | '90d'

export const ARCHIVE_TYPE_OPTIONS: { key: ArchiveType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'brief', label: 'Brief' },
  { key: 'needle', label: 'Needle' },
  { key: 'spotted', label: 'Spotted' },
  { key: 'overheard', label: 'Overheard' },
]

export const ARCHIVE_PERIOD_OPTIONS: { key: ArchivePeriod; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
]

export type ArchiveFeedItem =
  | { kind: 'brief'; sortAt: string; dateKey: string; brief: BuildBriefData }
  | { kind: 'needle'; sortAt: string; dateKey: string; needle: NeedleData }
  | { kind: 'spotted'; sortAt: string; spotted: SpottedEntry }
  | { kind: 'overheard'; sortAt: string; entry: OverheardEntry }

function periodToDays(period: ArchivePeriod): number {
  if (period === '7d') return 7
  if (period === '30d') return 30
  return 90
}

function sinceIsoForPeriod(period: ArchivePeriod): string {
  const days = periodToDays(period)
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
}

function sinceDateKeyForPeriod(period: ArchivePeriod): string {
  return mountainDateKeyDaysAgo(periodToDays(period))
}

function digestToBrief(digest: DailyDigestCache): BuildBriefData {
  // toBuildBriefData is not exported — mirror it locally
  return {
    text: digest.general,
    general: digest.general,
    ...(digest.generalNormie ? { generalNormie: digest.generalNormie } : {}),
    cards: digest.cards,
    dateKey: digest.dateKey,
    isToday: false,
    repoCount: digest.repoCount,
    commitCount: digest.commitCount,
    generatedAt: digest.generatedAt,
  }
}

async function loadBriefItems(sinceDateKey: string): Promise<ArchiveFeedItem[]> {
  const indexed = await listIndexedDateKeys(BRIEF_DATES_INDEX_KEY, sinceDateKey)
  const bootstrap = buildBriefEditionKeys().filter(k => k >= sinceDateKey)
  const dateKeys = [...new Set([...indexed, ...bootstrap])].sort((a, b) => b.localeCompare(a))

  const items: ArchiveFeedItem[] = []
  for (const dateKey of dateKeys) {
    const digest = await getCachedDigestForDate(dateKey)
    if (!digest) continue
    if (!indexed.includes(dateKey)) {
      await indexArchiveDate(BRIEF_DATES_INDEX_KEY, dateKey)
    }
    const brief = digestToBrief(digest)
    items.push({
      kind: 'brief',
      sortAt: digest.generatedAt || `${dateKey}T12:00:00.000Z`,
      dateKey,
      brief,
    })
  }
  return items
}

async function loadNeedleItems(sinceDateKey: string): Promise<ArchiveFeedItem[]> {
  const indexed = await listIndexedDateKeys(NEEDLE_DATES_INDEX_KEY, sinceDateKey)
  // Bootstrap: today + brief edition keys often hold needle editions too
  const bootstrap = [
    mountainDateKeyDaysAgo(0),
    ...buildBriefEditionKeys(),
  ].filter(k => k >= sinceDateKey)
  const dateKeys = [...new Set([...indexed, ...bootstrap])].sort((a, b) => b.localeCompare(a))

  const items: ArchiveFeedItem[] = []
  for (const dateKey of dateKeys) {
    const needle = await getCachedNeedleForDate(dateKey)
    if (!needle) continue
    if (!indexed.includes(dateKey)) {
      await indexArchiveDate(NEEDLE_DATES_INDEX_KEY, dateKey)
    }
    items.push({
      kind: 'needle',
      sortAt: needle.generatedAt || `${dateKey}T12:00:00.000Z`,
      dateKey,
      needle,
    })
  }
  return items
}

async function loadSpottedItems(sinceIso: string): Promise<ArchiveFeedItem[]> {
  const list = await listPublishedSpotted(sinceIso)
  return list.map(spotted => ({
    kind: 'spotted' as const,
    sortAt: spotted.publishedAt ?? spotted.createdAt,
    spotted,
  }))
}

async function loadOverheardItems(sinceIso: string): Promise<ArchiveFeedItem[]> {
  const list = await listPublishedMentionsSince(sinceIso)
  return list.map(entry => ({
    kind: 'overheard' as const,
    sortAt: entry.publishedAt ?? entry.confirmedAt ?? entry.scannedAt ?? '',
    entry,
  }))
}

export function parseArchiveType(raw: string | string[] | undefined): ArchiveType {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'brief' || v === 'needle' || v === 'spotted' || v === 'overheard' || v === 'all') return v
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
  const sinceIso = sinceIsoForPeriod(period)

  const loaders: Promise<ArchiveFeedItem[]>[] = []
  if (type === 'all' || type === 'brief') loaders.push(loadBriefItems(sinceDateKey))
  if (type === 'all' || type === 'needle') loaders.push(loadNeedleItems(sinceDateKey))
  if (type === 'all' || type === 'spotted') loaders.push(loadSpottedItems(sinceIso))
  if (type === 'all' || type === 'overheard') loaders.push(loadOverheardItems(sinceIso))

  const chunks = await Promise.all(loaders)
  return chunks
    .flat()
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
}
