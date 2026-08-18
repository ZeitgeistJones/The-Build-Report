import { getRedis } from '@/lib/redis'

const REGISTRY = 'https://registry.modelcontextprotocol.io/v0.1/servers'
const WIRE_KEY = 'build-report:mcp-wire'
const WIRE_ADMIN_KEY = 'build-report:mcp-wire:admin'
const TTL_SECONDS = 60 * 60 * 24 * 90

export const PAGE_CAP = 40
export const PRINT_CAP = 6
export const INBOX_CAP = 250

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

/** One piece of mail in the admin inbox — keep or skip, with a plain-English why. */
export type WireInboxRow = {
  keep: boolean
  kind: WireItem['kind'] | 'unknown'
  title?: string
  name: string
  description: string
  version: string
  repoUrl?: string
  at: string
  reason: string
  filterBucket?: 'marketing' | 'casino' | 'signals'
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
  inbox: WireInboxRow[]
  inboxCap: number
  inboxCapped: boolean
  inboxTotal: number
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

type ServerEntry = { row: RegistryRow; meta: RegistryMeta; versions: number }

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

    const existing = byServer.get(name)
    const at = meta.updatedAt ?? meta.publishedAt ?? ''
    const existingAt = existing?.meta.updatedAt ?? existing?.meta.publishedAt ?? ''

    if (!existing) {
      byServer.set(name, { row, meta, versions: 1 })
    } else {
      byServer.set(name, {
        row: at > existingAt ? row : existing.row,
        meta: at > existingAt ? meta : existing.meta,
        versions: existing.versions + 1,
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
  return {
    keep: false,
    kind: 'unknown',
    title: s?.title?.trim() || undefined,
    name: s?.name?.trim() || '(unnamed listing)',
    description: (s?.description ?? '').trim(),
    version: s?.version ?? '',
    repoUrl: s?.repository?.url,
    at: '',
    reason: 'Skipped — no registry name or official listing metadata.',
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

  const base = {
    kind,
    title,
    name,
    description,
    version,
    repoUrl,
    at,
  }

  if (!description) {
    return {
      row: {
        ...base,
        keep: false,
        reason: 'Skipped — no description to evaluate.',
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
          reason: hit.reason,
          filterBucket: hit.bucket,
        },
      }
    }
  }

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

  return {
    item,
    row: {
      ...base,
      keep: true,
      reason:
        kind === 'withdrawn'
          ? 'Withdrawn listing — kept even if a low-interest filter would otherwise apply.'
          : 'No low-interest filter matched.',
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
} {
  const { byServer, unnamed } = collapseByServer(rows)
  const items: WireItem[] = []
  const inbox: WireInboxRow[] = []
  let skippedFilterCount = 0
  let skippedOtherCount = unnamed.length

  for (const row of unnamed) inbox.push(inboxFromUnnamed(row))

  for (const [name, entry] of byServer) {
    const decided = decideEntry(name, entry)
    inbox.push(decided.row)
    if (decided.item) {
      items.push(decided.item)
    } else if (decided.row.filterBucket) {
      skippedFilterCount += 1
    } else {
      skippedOtherCount += 1
    }
  }

  const rank = { withdrawn: 0, new: 1, revised: 2 }
  items.sort((a, b) => rank[a.kind] - rank[b.kind] || b.at.localeCompare(a.at))

  inbox.sort((a, b) => {
    if (a.keep !== b.keep) return a.keep ? -1 : 1
    return (b.at || '').localeCompare(a.at || '')
  })

  return {
    items,
    inbox,
    rawCount: rows.length,
    keptCount: items.length,
    skippedFilterCount,
    skippedOtherCount,
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
    inbox: [],
    inboxCap: INBOX_CAP,
    inboxCapped: false,
    inboxTotal: 0,
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
      totalChanges: built.keptCount,
      collectedAt,
      error: fetched.complete
        ? undefined
        : `Page safety limit reached (${fetched.pagesFetched} of ${PAGE_CAP} max pages). Watermark not advanced.`,
    }

    const inboxTotal = built.inbox.length
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
      inbox: built.inbox.slice(0, INBOX_CAP),
      inboxCap: INBOX_CAP,
      inboxCapped: inboxTotal > INBOX_CAP,
      inboxTotal,
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
  const skipped = record.skippedFilterCount + record.skippedOtherCount
  if (record.snapshot.status === 'failed') {
    return `Failed — registry unavailable. Watermark NOT advanced.`
  }
  if (record.snapshot.status === 'partial') {
    return `Partial — page safety limit reached. Watermark NOT advanced.`
  }
  return `Complete — ${record.consideredCount} registry changes checked, ${record.keptCount} kept, ${skipped} skipped.`
}
