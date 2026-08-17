import { getRedis } from '@/lib/redis'

const REGISTRY = 'https://registry.modelcontextprotocol.io/v0.1/servers'
const WIRE_KEY = 'build-report:mcp-wire'
const TTL_SECONDS = 60 * 60 * 24 * 90

/** One dispatch on the wire. */
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

export type McpWireSnapshot = {
  dateKey: string
  status: 'ok' | 'failed'
  /** Watermark for the next run. Only advances after a fully successful walk. */
  through: string
  items: WireItem[]
  /** Total qualifying changes, including ones we didn't print. */
  totalChanges: number
  collectedAt: string
  error?: string
}

type RegistryMeta = {
  status?: string
  statusMessage?: string
  publishedAt?: string
  updatedAt?: string
  isLatest?: boolean
}

type RegistryRow = {
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
 * Registrations that are technically build events but aren't agent
 * infrastructure — ad platforms, SEO tools, storefronts. Without this the
 * wire reads like a marketing directory.
 */
const LOW_INTEREST = [
  /\b(seo|aeo|ads?|advertis|marketing|campaign|storefront|coupon|affiliate)\b/i,
  /\b(casino|betting|crypto\s*signals|trading\s*signals)\b/i,
]

function isInteresting(row: { name: string; description: string; title?: string }): boolean {
  const blob = `${row.name} ${row.title ?? ''} ${row.description}`
  return !LOW_INTEREST.some(re => re.test(blob))
}

/**
 * Walk every page of changes since `since`. Results are name-ordered, not
 * date-ordered, so we cannot stop early — we page until the cursor runs out.
 * The cap is a safety valve, not an expected exit.
 */
async function fetchChangesSince(since: string): Promise<RegistryRow[]> {
  const rows: RegistryRow[] = []
  let cursor: string | undefined
  let pages = 0

  while (pages < 40) {
    const url = new URL(REGISTRY)
    url.searchParams.set('updated_since', since)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url.toString(), {
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
    if (!cursor) return rows
  }

  // Hit the page cap. Better to report what we have than to hang the cron.
  console.warn('[mcp-wire] page cap reached; results may be incomplete')
  return rows
}

/**
 * Collapse the registry rows into printable dispatches.
 *
 * The registry returns one row per version, so a server that shipped three
 * versions yesterday appears three times. We keep the newest row per server
 * and let the version count decide whether it reads as new or revised.
 */
function toWireItems(rows: RegistryRow[]): WireItem[] {
  const byServer = new Map<string, { row: RegistryRow; meta: RegistryMeta; versions: number }>()

  for (const row of rows) {
    const name = row.server?.name
    const meta = row._meta?.[OFFICIAL_META]
    if (!name || !meta) continue

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

  const items: WireItem[] = []

  for (const [name, entry] of byServer) {
    const s = entry.row.server
    const m = entry.meta
    const description = (s?.description ?? '').trim()
    const title = s?.title?.trim()
    if (!description) continue

    const withdrawn = m.status === 'deleted' || m.status === 'deprecated'
    if (!withdrawn && !isInteresting({ name, description, title })) continue

    // A server whose first version landed in this window is new; anything
    // else is a revision of something that already existed.
    const isNew = entry.versions === 1 && m.publishedAt === m.updatedAt

    items.push({
      name,
      title,
      description,
      version: s?.version ?? '',
      kind: withdrawn ? 'withdrawn' : isNew ? 'new' : 'revised',
      note: m.statusMessage?.trim() || undefined,
      repoUrl: s?.repository?.url,
      at: m.updatedAt ?? m.publishedAt ?? '',
    })
  }

  // Withdrawals lead — they're the rarest and the most newsworthy.
  const rank = { withdrawn: 0, new: 1, revised: 2 }
  return items.sort((a, b) => rank[a.kind] - rank[b.kind] || b.at.localeCompare(a.at))
}

/** Fetch, normalize, and cache one edition of the wire. */
export async function collectMcpWire(dateKey: string): Promise<McpWireSnapshot> {
  const redis = getRedis()
  const prior = await redis.get<McpWireSnapshot>(`${WIRE_KEY}:latest`).catch(() => null)

  // Fall back to 24h if we have no watermark, or if the last run failed.
  const since =
    prior?.status === 'ok' && prior.through
      ? prior.through
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const collectedAt = new Date().toISOString()

  try {
    const rows = await fetchChangesSince(since)
    const all = toWireItems(rows)

    const snapshot: McpWireSnapshot = {
      dateKey,
      status: 'ok',
      through: collectedAt,
      items: all.slice(0, 6),
      totalChanges: all.length,
      collectedAt,
    }

    await redis.set(`${WIRE_KEY}:${dateKey}`, snapshot, { ex: TTL_SECONDS })
    await redis.set(`${WIRE_KEY}:latest`, snapshot, { ex: TTL_SECONDS })
    return snapshot
  } catch (err) {
    const message = err instanceof Error ? err.message : 'registry unreachable'
    console.error('[mcp-wire] collection failed:', message)

    // Do NOT advance the watermark — the next run should re-request this window.
    const snapshot: McpWireSnapshot = {
      dateKey,
      status: 'failed',
      through: prior?.through ?? '',
      items: [],
      totalChanges: 0,
      collectedAt,
      error: message,
    }
    await redis.set(`${WIRE_KEY}:${dateKey}`, snapshot, { ex: TTL_SECONDS })
    return snapshot
  }
}

export async function getMcpWire(dateKey: string): Promise<McpWireSnapshot | null> {
  try {
    const redis = getRedis()
    return await redis.get<McpWireSnapshot>(`${WIRE_KEY}:${dateKey}`)
  } catch {
    return null
  }
}
