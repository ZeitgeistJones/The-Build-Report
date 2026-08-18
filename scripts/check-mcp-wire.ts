/**
 * Wire inbox + watermark correctness.
 * Run: npx --yes tsx scripts/check-mcp-wire.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  buildWireCollection,
  collectMcpWireDetailed,
  fetchChangesSince,
  lowInterestMatch,
  nextWatermark,
  resolveSince,
  wireRefreshSummary,
  type McpWireAdminRecord,
  type McpWireSnapshot,
  type RegistryRow,
} from '../lib/mcpWire'

function expect(name: string, cond: boolean) {
  if (!cond) throw new Error(`FAIL: ${name}`)
  console.log(`ok — ${name}`)
}

const META = 'io.modelcontextprotocol.registry/official'

function listing(opts: {
  name?: string
  title?: string
  description?: string
  version?: string
  publishedAt?: string
  updatedAt?: string
  status?: string
  repoUrl?: string
  skipMeta?: boolean
}): RegistryRow {
  return {
    server: {
      name: opts.name,
      title: opts.title,
      description: opts.description,
      version: opts.version ?? '1.0.0',
      repository: opts.repoUrl ? { url: opts.repoUrl } : undefined,
    },
    _meta: opts.skipMeta
      ? undefined
      : {
          [META]: {
            publishedAt: opts.publishedAt ?? '2026-08-17T10:00:00.000Z',
            updatedAt: opts.updatedAt ?? '2026-08-17T10:00:00.000Z',
            status: opts.status,
          },
        },
  }
}

const PRIOR: McpWireSnapshot = {
  dateKey: '2026-08-16',
  status: 'ok',
  through: '2026-08-16T07:00:00.000Z',
  items: [],
  totalChanges: 0,
  collectedAt: '2026-08-16T07:00:00.000Z',
}

function memoryStore(prior: McpWireSnapshot | null) {
  let latest = prior
  let savedAdmin: McpWireAdminRecord | null = null
  return {
    getPrior: async () => latest,
    savePublic: async (snapshot: McpWireSnapshot) => {
      latest = snapshot
    },
    saveAdmin: async (record: McpWireAdminRecord) => {
      savedAdmin = record
    },
    get latest() {
      return latest
    },
    get admin() {
      return savedAdmin
    },
  }
}

async function main() {
/* 1. Fully exhausted pagination advances the watermark. */
{
  const store = memoryStore(PRIOR)
  const collectedAt = '2026-08-17T12:00:00.000Z'
  const record = await collectMcpWireDetailed('2026-08-17', {
    getPrior: store.getPrior,
    savePublic: store.savePublic,
    saveAdmin: store.saveAdmin,
    now: () => new Date(collectedAt),
    fetchChanges: async () => ({
      rows: [listing({ name: 'io.example/keep', description: 'A connector for calendars.' })],
      pagesFetched: 1,
      complete: true,
    }),
  })
  expect('complete status is ok', record.snapshot.status === 'ok')
  expect('complete advances watermark', record.watermarkAdvanced === true)
  expect('complete through is collection time', record.snapshot.through === collectedAt)
  expect('complete snapshot has no inbox field', !('inbox' in record.snapshot))
}

/* 2. Failed run does not advance watermark. */
{
  const store = memoryStore(PRIOR)
  try {
    await collectMcpWireDetailed('2026-08-17', {
      getPrior: store.getPrior,
      savePublic: store.savePublic,
      saveAdmin: store.saveAdmin,
      now: () => new Date('2026-08-17T12:00:00.000Z'),
      fetchChanges: async () => {
        throw new Error('registry responded 503')
      },
    })
  } catch {
    throw new Error('FAIL: failed collection should not throw to caller')
  }
  expect('failed status', store.latest?.status === 'failed')
  expect('failed keeps prior through', store.latest?.through === PRIOR.through)
  expect('failed watermark not advanced', store.admin?.watermarkAdvanced === false)
  expect(
    'failed summary',
    wireRefreshSummary(store.admin!) === 'Failed — registry unavailable. Watermark NOT advanced.',
  )
}

/* 3. Page-cap / partial run does not advance watermark. */
{
  const store = memoryStore(PRIOR)
  const record = await collectMcpWireDetailed('2026-08-17', {
    getPrior: store.getPrior,
    savePublic: store.savePublic,
    saveAdmin: store.saveAdmin,
    now: () => new Date('2026-08-17T12:00:00.000Z'),
    fetchChanges: async () => ({
      rows: [listing({ name: 'io.example/keep', description: 'A connector for calendars.' })],
      pagesFetched: 40,
      complete: false,
    }),
  })
  expect('partial status', record.snapshot.status === 'partial')
  expect('partial does not advance watermark', record.watermarkAdvanced === false)
  expect('partial through stays prior', record.snapshot.through === PRIOR.through)
  expect(
    'partial summary',
    wireRefreshSummary(record) === 'Partial — page safety limit reached. Watermark NOT advanced.',
  )

  let pages = 0
  const fetched = await fetchChangesSince('2026-08-16T07:00:00.000Z', {
    pageCap: 3,
    fetchFn: async () => {
      pages += 1
      return new Response(
        JSON.stringify({
          servers: [listing({ name: `io.example/p${pages}`, description: 'Pager.' })],
          metadata: { nextCursor: 'still-more' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    },
  })
  expect('fetchChangesSince stops at page cap', fetched.complete === false && fetched.pagesFetched === 3)
}

expect(
  'nextWatermark only advances on ok',
  nextWatermark('ok', 'old', 'new').watermarkAdvanced === true &&
    nextWatermark('partial', 'old', 'new').through === 'old' &&
    nextWatermark('failed', 'old', 'new').through === 'old',
)

expect(
  'failed prior still retries from stored through',
  resolveSince('2026-08-16T07:00:00.000Z', Date.parse('2026-08-17T12:00:00.000Z')) ===
    '2026-08-16T07:00:00.000Z',
)

/* 4 + 5. Filter reasons + keep vs skip. */
{
  const built = buildWireCollection([
    listing({
      name: 'io.example/calendar',
      title: 'Calendar',
      description: 'Let an assistant read a calendar.',
      repoUrl: 'https://github.com/example/calendar',
    }),
    listing({
      name: 'io.example/ads',
      description: 'An advertising campaign manager for storefront coupons.',
    }),
    listing({
      name: 'io.example/casino',
      description: 'Casino and betting odds for agents.',
    }),
    listing({
      name: 'io.example/signals',
      description: 'Crypto signals and trading signals feed.',
    }),
    listing({
      name: 'io.example/clawd-agent',
      description: 'A crypto agent wallet helper for CLAWD holders.',
    }),
    listing({ name: 'io.example/empty', description: '   ' }),
    listing({ description: 'Mystery row', skipMeta: true }),
  ])

  const byName = Object.fromEntries(built.inbox.map(r => [r.name, r]))
  expect('kept calendar', byName['io.example/calendar']?.keep === true)
  expect(
    'kept reason is plain English',
    byName['io.example/calendar']?.reason === 'No low-interest filter matched.',
  )
  expect(
    'marketing skip reason',
    byName['io.example/ads']?.keep === false &&
      byName['io.example/ads']?.reason === 'Matched marketing/advertising filter.',
  )
  expect(
    'casino skip reason',
    byName['io.example/casino']?.reason === 'Matched casino/betting filter.',
  )
  expect(
    'signals skip reason',
    byName['io.example/signals']?.reason === 'Matched crypto/trading-signals filter.',
  )
  expect(
    'crypto-agent project is not filtered as signals',
    byName['io.example/clawd-agent']?.keep === true,
  )
  expect('kept distinguishable from skipped', built.keptCount === 2 && built.skippedFilterCount === 3)
  expect('empty description skipped with reason', byName['io.example/empty']?.reason.includes('no description'))
}

expect(
  'lowInterestMatch does not use regex in the reason',
  lowInterestMatch('affiliate marketing desk')?.reason === 'Matched marketing/advertising filter.' &&
    !/\\b|\(\?:/.test(lowInterestMatch('affiliate marketing desk')?.reason ?? ''),
)

/* 6. Public Yesterday's Builds still hides The Wire. */
{
  const yb = readFileSync(join(process.cwd(), 'app/yesterdays-builds/page.tsx'), 'utf8')
  const mcp = readFileSync(join(process.cwd(), 'components/McpWire.tsx'), 'utf8')
  expect('public YB does not pass admin to McpWire', /<McpWire wire=\{wire\} \/>/.test(yb))
  expect('McpWire still requires admin to render', /if \(!admin \|\| !wire\) return null/.test(mcp))
}

{
  const store = memoryStore(PRIOR)
  const record = await collectMcpWireDetailed('2026-08-17', {
    getPrior: store.getPrior,
    savePublic: store.savePublic,
    saveAdmin: store.saveAdmin,
    now: () => new Date('2026-08-17T12:00:00.000Z'),
    fetchChanges: async () => ({
      rows: [
        listing({ name: 'io.keep/a', description: 'Useful filesystem connector.' }),
        listing({ name: 'io.skip/ads', description: 'SEO marketing campaign tool.' }),
      ],
      pagesFetched: 1,
      complete: true,
    }),
  })
  expect(
    'complete summary names kept vs skipped',
    wireRefreshSummary(record) === 'Complete — 2 registry changes checked, 1 kept, 1 skipped.',
  )
  expect('admin inbox has both decisions', record.inbox.length === 2 && record.inbox.some(r => r.keep) && record.inbox.some(r => !r.keep))
}

console.log('all mcp-wire checks passed')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
