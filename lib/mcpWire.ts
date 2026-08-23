import { getRedis } from '@/lib/redis'
import {
  composeWhyShownText,
  firstSentence,
  githubPublisherDisplay,
  happenedLine,
  parseRegistryStatus,
  surfaceWhy,
  type RegistryLifecycle,
  type TrackedProjectHit,
  type WireWhyCode,
} from '@/lib/mcpWireSignals'
import { selectPublicWireItems } from '@/lib/mcpWirePublic'

const REGISTRY = 'https://registry.modelcontextprotocol.io/v0.1/servers'
const WIRE_KEY = 'build-report:mcp-wire'
const WIRE_ADMIN_KEY = 'build-report:mcp-wire:admin'
const TTL_SECONDS = 60 * 60 * 24 * 90

export const PAGE_CAP = 40
export const PRINT_CAP = 5
export const INBOX_CAP = 250
export const SHOW_STORE_CAP = 80
export const ROUTINE_STORE_CAP = 50
export const FILTERED_STORE_CAP = 80

/** One dispatch on the wire (newspaper preview / public snapshot). */
export type WireItem = {
  name: string
  title?: string
  description: string
  version: string
  /** 'new' = first version we've seen. 'revised' = a later version. 'withdrawn' = deleted/deprecated. */
  kind: 'new' | 'revised' | 'withdrawn'
  /** Reason the publisher gave for withdrawal, when there is one. */
  note?: string
  repoUrl?: string
  at: string
  registryStatus?: RegistryLifecycle
  whyShown?: WireWhyCode[]
  trackedLabel?: string
}

export type McpWireStatus = 'ok' | 'partial' | 'failed'

export type McpWireSnapshot = {
  dateKey: string
  status: McpWireStatus
  /** Last *successful* watermark. Only advances after a fully exhausted walk. */
  through: string
  items: WireItem[]
  /** Total qualifying (kept) changes, including ones we didn't print. */
  totalChanges: number
  collectedAt: string
  error?: string
}

export type WirePile = 'show' | 'routine' | 'filtered'

/** One piece of mail in the admin inbox. */
export type WireInboxRow = {
  keep: boolean
  pile: WirePile
  kind: WireItem['kind'] | 'unknown'
  title?: string
  name: string
  description: string
  version: string
  repoUrl?: string
  at: string
  reason: string
  filterBucket?: 'marketing' | 'casino' | 'signals'
  whatItIs?: string
  whatHappened?: string
  whyShown?: WireWhyCode[]
  whyShownText?: string
  tracked?: TrackedProjectHit | null
  publisher?: string
  registryStatus?: RegistryLifecycle
  statusMessage?: string
  publishedAt?: string
  updatedAt?: string
}

export type McpWireAdminRecord = {
  snapshot: McpWireSnapshot
  since: string
  pagesFetched: number
  pageCap: number
  paginationComplete: boolean
  watermarkAdvanced: boolean
  rawRegistryRows: number
  consideredCount: number
  keptCount: number
  skippedFilterCount: number
  skippedOtherCount: number
  printedCount: number
  showMeCount: number
  routineCount: number
  filteredCount: number
  reasonCounts: Partial<Record<WireWhyCode, number>>
  inbox: WireInboxRow[]
  inboxCap: number
  inboxCapped: boolean
  inboxTotal: number
  showStored: number
  routineStored: number
  filteredStored: number
  /** Raw rows minus grouped listings — extra versions folded into one name. */
  extraVersionRows: number
}

type RegistryMeta = {
  status?: string
  statusMessage?: string
  publishedAt?: string
  updatedAt?: string
  isLatest?: boolean
}

export type RegistryRow = {
  server?: {
    name?: string
    title?: string
    description?: string
    version?: string
    repository?: { url?: string }
  }
  _meta?: Record<string, RegistryMeta>
}

const OFFICIAL_META = 'io.modelcontextprotocol.registry/official'

/** Exact official Registry JSON for this name + version. Always asks include_deleted so removals still open. */
export function officialRegistryRecordUrl(name: string, version?: string): string {
  const encodedName = encodeURIComponent(name.trim())
  const ver = version?.trim() ? encodeURIComponent(version.trim()) : 'latest'
  return `${REGISTRY}/${encodedName}/versions/${ver}?include_deleted=true`
}

/**
 * Same editorial buckets as the original LOW_INTEREST list.
 * Do not change match behavior here — only the reported reason string.
 */
const MARKETING_RE = /\b(seo|aeo|ads?|advertis|marketing|campaign|storefront|coupon|affiliate)\b/i
const CASINO_RE = /\b(casino|betting)\b/i
const SIGNALS_RE = /\b(crypto\s*signals|trading\s*signals)\b/i

export function lowInterestMatch(blob: string): { bucket: 'marketing' | 'casino' | 'signals'; reason: string } | null {
  if (MARKETING_RE.test(blob)) {
    return { bucket: 'marketing', reason: 'Matched marketing/advertising filter.' }
  }
  if (CASINO_RE.test(blob)) {
    return { bucket: 'casino', reason: 'Matched casino/betting filter.' }
  }
  if (SIGNALS_RE.test(blob)) {
    return { bucket: 'signals', reason: 'Matched crypto/trading-signals filter.' }
  }
  return null
}

export function collectionStatusLabel(status: McpWireStatus): 'COMPLETE' | 'PARTIAL' | 'FAILED' {
  if (status === 'ok') return 'COMPLETE'
  if (status === 'partial') return 'PARTIAL'
  return 'FAILED'
}

/** Next walk starts at the last successful watermark, even if the latest run failed or was partial. */
export function resolveSince(priorThrough: string | undefined | null, nowMs: number): string {
  if (priorThrough) return priorThrough
  return new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()
}

export function nextWatermark(
  status: McpWireStatus,
  priorThrough: string,
  collectedAt: string,
): { through: string; watermarkAdvanced: boolean } {
  if (status === 'ok') return { through: collectedAt, watermarkAdvanced: true }
  return { through: priorThrough, watermarkAdvanced: false }
}

export type FetchChangesResult = {
  rows: RegistryRow[]
  pagesFetched: number
  complete: boolean
}

/**
 * Walk every page of changes since `since`. Results are name-ordered, not
 * date-ordered, so we cannot stop early — we page until the cursor runs out.
 * Hitting PAGE_CAP is incomplete, not success.
 */
export async function fetchChangesSince(
  since: string,
  options: { fetchFn?: typeof fetch; pageCap?: number } = {},
): Promise<FetchChangesResult> {
  const fetchFn = options.fetchFn ?? fetch
  const pageCap = options.pageCap ?? PAGE_CAP
  const rows: RegistryRow[] = []
  let cursor: string | undefined
  let pages = 0

  while (pages < pageCap) {
    const url = new URL(REGISTRY)
    url.searchParams.set('updated_since', since)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetchFn(url.toString(), {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`registry responded ${res.status}`)

    const data = (await res.json()) as {
      servers?: RegistryRow[]
      metadata?: { nextCursor?: string | null }
    }

    rows.push(...(data.servers ?? []))
    cursor = data.metadata?.nextCursor || undefined
    pages += 1
    if (!cursor) return { rows, pagesFetched: pages, complete: true }
  }

  console.warn('[mcp-wire] page cap reached; results are partial — watermark will not advance')
  return { rows, pagesFetched: pages, complete: false }
}

type ServerEntry = {
  row: RegistryRow
  meta: RegistryMeta
  versions: number
  oldestDescription: string
  newestDescription: string
}

function collapseByServer(rows: RegistryRow[]): {
  byServer: Map<string, ServerEntry>
  unnamed: RegistryRow[]
} {
  const byServer = new Map<string, ServerEntry>()
  const unnamed: RegistryRow[] = []

  for (const row of rows) {
    const name = row.server?.name
    const meta = row._meta?.[OFFICIAL_META]
    if (!name || !meta) {
      unnamed.push(row)
      continue
    }

    const description = (row.server?.description ?? '').trim()
    const existing = byServer.get(name)
    const at = meta.updatedAt ?? meta.publishedAt ?? ''
    const existingAt = existing?.meta.updatedAt ?? existing?.meta.publishedAt ?? ''

    if (!existing) {
      byServer.set(name, {
        row,
        meta,
        versions: 1,
        oldestDescription: description,
        newestDescription: description,
      })
    } else if (at >= existingAt) {
      byServer.set(name, {
        row,
        meta,
        versions: existing.versions + 1,
        oldestDescription: existing.oldestDescription || description,
        newestDescription: description,
      })
    } else {
      byServer.set(name, {
        ...existing,
        versions: existing.versions + 1,
        oldestDescription: description || existing.oldestDescription,
      })
    }
  }

  return { byServer, unnamed }
}

function kindFor(entry: ServerEntry): WireItem['kind'] {
  const withdrawn = entry.meta.status === 'deleted' || entry.meta.status === 'deprecated'
  if (withdrawn) return 'withdrawn'
  const isNew = entry.versions === 1 && entry.meta.publishedAt === entry.meta.updatedAt
  return isNew ? 'new' : 'revised'
}

function inboxFromUnnamed(row: RegistryRow): WireInboxRow {
  const s = row.server
  const m = row._meta?.[OFFICIAL_META]
  const status = parseRegistryStatus(m?.status)
  return {
    keep: false,
    pile: 'filtered',
    kind: 'unknown',
    title: s?.title?.trim() || undefined,
    name: s?.name?.trim() || '(unnamed listing)',
    description: (s?.description ?? '').trim(),
    version: s?.version ?? '',
    repoUrl: s?.repository?.url,
    at: m?.updatedAt ?? m?.publishedAt ?? '',
    reason: 'Skipped — no registry name or official listing metadata.',
    whatItIs: firstSentence((s?.description ?? '').trim()),
    whatHappened: happenedLine('unknown', status),
    whyShown: [],
    whyShownText: 'Skipped — no registry name or official listing metadata.',
    publisher: githubPublisherDisplay(s?.repository?.url),
    registryStatus: status,
    statusMessage: m?.statusMessage?.trim() || undefined,
    publishedAt: m?.publishedAt,
    updatedAt: m?.updatedAt,
  }
}

function decideEntry(name: string, entry: ServerEntry): { item?: WireItem; row: WireInboxRow } {
  const s = entry.row.server
  const m = entry.meta
  const description = (s?.description ?? '').trim()
  const title = s?.title?.trim()
  const kind = kindFor(entry)
  const at = m.updatedAt ?? m.publishedAt ?? ''
  const version = s?.version ?? ''
  const repoUrl = s?.repository?.url
  const note = m.statusMessage?.trim() || undefined
  const publisher = githubPublisherDisplay(repoUrl)
  const registryStatus = parseRegistryStatus(m.status)

  const base: Omit<WireInboxRow, 'keep' | 'pile' | 'reason'> = {
    kind,
    title,
    name,
    description,
    version,
    repoUrl,
    at,
    whatItIs: firstSentence(description),
    whatHappened: happenedLine(kind, registryStatus),
    publisher,
    registryStatus,
    statusMessage: note,
    publishedAt: m.publishedAt,
    updatedAt: m.updatedAt,
  }

  if (!description) {
    return {
      row: {
        ...base,
        keep: false,
        pile: 'filtered',
        reason: 'Skipped — no description to evaluate.',
        whyShown: [],
        whyShownText: 'Skipped — no description to evaluate.',
      },
    }
  }

  if (kind !== 'withdrawn') {
    const blob = `${name} ${title ?? ''} ${description}`
    const hit = lowInterestMatch(blob)
    if (hit) {
      return {
        row: {
          ...base,
          keep: false,
          pile: 'filtered',
          reason: hit.reason,
          filterBucket: hit.bucket,
          whyShown: [],
          whyShownText: hit.reason,
        },
      }
    }
  }

  const surfaced = surfaceWhy({
    kind,
    name,
    title,
    description,
    version,
    repoUrl,
    oldestDescription: entry.oldestDescription,
  })

  const item: WireItem = {
    name,
    title,
    description,
    version,
    kind,
    note,
    repoUrl,
    at,
  }

  if (surfaced.surface) {
    return {
      item,
      row: {
        ...base,
        keep: true,
        pile: 'show',
        reason: surfaced.why.map(w => w).join(', '),
        whyShown: surfaced.why,
        whyShownText: composeWhyShownText({
          why: surfaced.why,
          tracked: surfaced.tracked,
          kind,
          registryStatus,
        }),
        tracked: surfaced.tracked,
      },
    }
  }

  return {
    row: {
      ...base,
      keep: true,
      pile: 'routine',
      reason: 'Routine update — no SHOW ME signal.',
      whyShown: [],
      whyShownText:
        'No tracked-project, crypto/onchain, consequential-access, withdrawal, or first-release signal — treated as a routine update.',
      tracked: surfaced.tracked,
    },
  }
}

/**
 * Collapse registry rows into printable items + the full admin inbox.
 * Filter match behavior is unchanged; every considered server gets a reason.
 */
export function buildWireCollection(rows: RegistryRow[]): {
  items: WireItem[]
  inbox: WireInboxRow[]
  rawCount: number
  keptCount: number
  skippedFilterCount: number
  skippedOtherCount: number
  showMeCount: number
  routineCount: number
  filteredCount: number
  extraVersionRows: number
  reasonCounts: Partial<Record<WireWhyCode, number>>
} {
  const { byServer, unnamed } = collapseByServer(rows)
  const allRows: WireInboxRow[] = []
  let skippedFilterCount = 0
  let skippedOtherCount = unnamed.length

  for (const row of unnamed) allRows.push(inboxFromUnnamed(row))

  for (const [name, entry] of byServer) {
    const decided = decideEntry(name, entry)
    allRows.push(decided.row)
    if (!decided.item) {
      if (decided.row.filterBucket) skippedFilterCount += 1
      else skippedOtherCount += 1
    }
  }

  const show = allRows.filter(r => r.pile === 'show')
  const routine = allRows.filter(r => r.pile === 'routine')
  const filtered = allRows.filter(r => r.pile === 'filtered')

  // Admin SHOW ME: new registrations first so they're easy to find; removals next.
  const rank = { new: 0, withdrawn: 1, revised: 2, unknown: 3 }
  show.sort(
    (a, b) =>
      Number(!!b.tracked) - Number(!!a.tracked) ||
      rank[a.kind] - rank[b.kind] ||
      (b.at || '').localeCompare(a.at || ''),
  )
  routine.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
  filtered.sort((a, b) => (b.at || '').localeCompare(a.at || ''))

  const reasonCounts: Partial<Record<WireWhyCode, number>> = {}
  for (const row of show) {
    for (const code of row.whyShown ?? []) {
      reasonCounts[code] = (reasonCounts[code] ?? 0) + 1
    }
  }

  const stored = [
    ...show.slice(0, SHOW_STORE_CAP),
    ...routine.slice(0, ROUTINE_STORE_CAP),
    ...filtered.slice(0, FILTERED_STORE_CAP),
  ]

  const printItems = selectPublicWireItems(show)

  return {
    items: printItems,
    inbox: stored,
    rawCount: rows.length,
    keptCount: show.length + routine.length,
    skippedFilterCount,
    skippedOtherCount,
    showMeCount: show.length,
    routineCount: routine.length,
    filteredCount: filtered.length,
    extraVersionRows: Math.max(0, rows.length - allRows.length),
    reasonCounts,
  }
}

export type CollectMcpWireDeps = {
  getPrior?: () => Promise<McpWireSnapshot | null>
  savePublic?: (snapshot: McpWireSnapshot) => Promise<void>
  saveAdmin?: (record: McpWireAdminRecord) => Promise<void>
  fetchChanges?: (since: string) => Promise<FetchChangesResult>
  now?: () => Date
}

function emptyAdminRecord(
  snapshot: McpWireSnapshot,
  extras: Partial<McpWireAdminRecord> & Pick<McpWireAdminRecord, 'since'>,
): McpWireAdminRecord {
  return {
    snapshot,
    pagesFetched: 0,
    pageCap: PAGE_CAP,
    paginationComplete: false,
    watermarkAdvanced: false,
    rawRegistryRows: 0,
    consideredCount: 0,
    keptCount: 0,
    skippedFilterCount: 0,
    skippedOtherCount: 0,
    printedCount: 0,
    showMeCount: 0,
    routineCount: 0,
    filteredCount: 0,
    reasonCounts: {},
    inbox: [],
    inboxCap: INBOX_CAP,
    inboxCapped: false,
    inboxTotal: 0,
    showStored: 0,
    routineStored: 0,
    filteredStored: 0,
    extraVersionRows: 0,
    ...extras,
  }
}

async function redisGetPrior(): Promise<McpWireSnapshot | null> {
  const redis = getRedis()
  return await redis.get<McpWireSnapshot>(`${WIRE_KEY}:latest`)
}

async function redisSavePublic(snapshot: McpWireSnapshot): Promise<void> {
  const redis = getRedis()
  await redis.set(`${WIRE_KEY}:${snapshot.dateKey}`, snapshot, { ex: TTL_SECONDS })
  await redis.set(`${WIRE_KEY}:latest`, snapshot, { ex: TTL_SECONDS })
}

async function redisSaveAdmin(record: McpWireAdminRecord): Promise<void> {
  const redis = getRedis()
  await redis.set(`${WIRE_ADMIN_KEY}:${record.snapshot.dateKey}`, record, { ex: TTL_SECONDS })
  await redis.set(`${WIRE_ADMIN_KEY}:latest`, record, { ex: TTL_SECONDS })
}

/** Fetch, normalize, and cache one edition. Returns the admin record (includes public snapshot). */
export async function collectMcpWireDetailed(
  dateKey: string,
  deps: CollectMcpWireDeps = {},
): Promise<McpWireAdminRecord> {
  const getPrior = deps.getPrior ?? redisGetPrior
  const savePublic = deps.savePublic ?? redisSavePublic
  const saveAdmin = deps.saveAdmin ?? redisSaveAdmin
  const fetchChanges = deps.fetchChanges ?? fetchChangesSince
  const now = deps.now ?? (() => new Date())

  const prior = await getPrior().catch(() => null)
  const priorThrough = prior?.through ?? ''
  const collectedAt = now().toISOString()
  const since = resolveSince(priorThrough || null, now().getTime())

  try {
    const fetched = await fetchChanges(since)
    const built = buildWireCollection(fetched.rows)
    const status: McpWireStatus = fetched.complete ? 'ok' : 'partial'
    const { through, watermarkAdvanced } = nextWatermark(status, priorThrough, collectedAt)
    const printed = built.items.slice(0, PRINT_CAP)

    const snapshot: McpWireSnapshot = {
      dateKey,
      status,
      through,
      items: printed,
      totalChanges: built.showMeCount,
      collectedAt,
      error: fetched.complete
        ? undefined
        : `Page safety limit reached (${fetched.pagesFetched} of ${PAGE_CAP} max pages). Watermark not advanced.`,
    }

    const inboxTotal = built.showMeCount + built.routineCount + built.filteredCount
    const record: McpWireAdminRecord = {
      snapshot,
      since,
      pagesFetched: fetched.pagesFetched,
      pageCap: PAGE_CAP,
      paginationComplete: fetched.complete,
      watermarkAdvanced,
      rawRegistryRows: built.rawCount,
      consideredCount: inboxTotal,
      keptCount: built.keptCount,
      skippedFilterCount: built.skippedFilterCount,
      skippedOtherCount: built.skippedOtherCount,
      printedCount: printed.length,
      showMeCount: built.showMeCount,
      routineCount: built.routineCount,
      filteredCount: built.filteredCount,
      reasonCounts: built.reasonCounts,
      inbox: built.inbox,
      inboxCap: INBOX_CAP,
      inboxCapped:
        built.showMeCount > SHOW_STORE_CAP ||
        built.routineCount > ROUTINE_STORE_CAP ||
        built.filteredCount > FILTERED_STORE_CAP,
      inboxTotal,
      showStored: Math.min(built.showMeCount, SHOW_STORE_CAP),
      routineStored: Math.min(built.routineCount, ROUTINE_STORE_CAP),
      filteredStored: Math.min(built.filteredCount, FILTERED_STORE_CAP),
      extraVersionRows: built.extraVersionRows,
    }

    await savePublic(snapshot)
    await saveAdmin(record)
    return record
  } catch (err) {
    const message = err instanceof Error ? err.message : 'registry unreachable'
    console.error('[mcp-wire] collection failed:', message)

    const { through, watermarkAdvanced } = nextWatermark('failed', priorThrough, collectedAt)
    const snapshot: McpWireSnapshot = {
      dateKey,
      status: 'failed',
      through,
      items: [],
      totalChanges: 0,
      collectedAt,
      error: message,
    }
    const record = emptyAdminRecord(snapshot, {
      since,
      watermarkAdvanced,
    })
    await savePublic(snapshot)
    await saveAdmin(record)
    return record
  }
}

/** Fetch, normalize, and cache one edition of the wire. */
export async function collectMcpWire(dateKey: string, deps: CollectMcpWireDeps = {}): Promise<McpWireSnapshot> {
  const record = await collectMcpWireDetailed(dateKey, deps)
  return record.snapshot
}

export async function getMcpWire(dateKey: string): Promise<McpWireSnapshot | null> {
  try {
    const redis = getRedis()
    return await redis.get<McpWireSnapshot>(`${WIRE_KEY}:${dateKey}`)
  } catch {
    return null
  }
}

/** Admin-only diagnostic record. Never used by the public newspaper page. */
export async function getMcpWireAdmin(dateKey: string): Promise<McpWireAdminRecord | null> {
  try {
    const redis = getRedis()
    const record = await redis.get<McpWireAdminRecord>(`${WIRE_ADMIN_KEY}:${dateKey}`)
    if (record) return record
    const snapshot = await redis.get<McpWireSnapshot>(`${WIRE_KEY}:${dateKey}`)
    if (!snapshot) return null
    return emptyAdminRecord(snapshot, {
      since: snapshot.through || '',
      printedCount: snapshot.items.length,
      keptCount: snapshot.totalChanges,
    })
  } catch {
    return null
  }
}

export function wireRefreshSummary(record: McpWireAdminRecord): string {
  if (record.snapshot.status === 'failed') {
    return 'Failed — Registry unavailable. Watermark NOT advanced.'
  }
  if (record.snapshot.status === 'partial') {
    return 'Partial — page safety limit reached. Watermark NOT advanced.'
  }
  const checked = record.consideredCount
  const surfaced = record.showMeCount ?? 0
  if (checked === 0) return 'Complete — no new Registry changes.'
  if (checked === 1) {
    return `Complete — 1 listing checked after grouping, ${surfaced} surfaced.`
  }
  return `Complete — ${checked} listings checked after grouping, ${surfaced} surfaced.`
}
