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
  officialRegistryRecordUrl,
  resolveSince,
  wireRefreshSummary,
  type McpWireAdminRecord,
  type McpWireSnapshot,
  type RegistryRow,
} from '../lib/mcpWire'
import {
  githubRepoDisplay,
  matchTrackedProject,
  registryReasonLine,
} from '../lib/mcpWireSignals'
import { resolveAdminSectionId } from '../lib/adminNav'

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
  statusMessage?: string
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
            statusMessage: opts.statusMessage,
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
    wireRefreshSummary(store.admin!) === 'Failed — Registry unavailable. Watermark NOT advanced.',
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
  expect('calendar is routine, not filtered', byName['io.example/calendar']?.pile === 'routine')
  expect(
    'routine reason is plain English',
    (byName['io.example/calendar']?.whyShownText ?? '').toLowerCase().includes('routine'),
  )
  expect(
    'marketing skip reason',
    byName['io.example/ads']?.pile === 'filtered' &&
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
    byName['io.example/clawd-agent']?.pile !== 'filtered',
  )
  expect('crypto-agent is surfaced as onchain', byName['io.example/clawd-agent']?.pile === 'show')
  expect('piles distinguishable', built.showMeCount === 1 && built.routineCount === 1 && built.filteredCount === 5)
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
    'complete summary names surfaced count',
    wireRefreshSummary(record) === 'Complete — 2 listings checked after grouping, 0 surfaced.',
  )
  expect(
    'admin inbox has routine vs filtered',
    record.inbox.some(r => r.pile === 'routine') && record.inbox.some(r => r.pile === 'filtered'),
  )
}

{
  const mastra = matchTrackedProject({
    name: 'io.github.mastra-ai/mastra',
    title: 'Mastra Wallet Tools',
    repoUrl: 'https://github.com/mastra-ai/mastra',
  })
  expect('tracked match uses github owner/repo', mastra?.label === 'Mastra')

  const descriptionOnly = matchTrackedProject({
    name: 'com.random/tools',
    title: 'Helper',
    repoUrl: undefined,
  })
  expect('no match from empty identifiers', descriptionOnly === null)

  const vague = matchTrackedProject({
    name: 'com.acme/notes',
    title: 'A mastra-like agent',
    repoUrl: 'https://github.com/acme/notes',
  })
  expect('no fuzzy title/description match', vague === null)

  const googleNoise = matchTrackedProject({
    name: 'io.github.google/drive',
    repoUrl: 'https://github.com/google/drive',
  })
  expect('broad org requires focus repo', googleNoise === null)

  const googleHit = matchTrackedProject({
    name: 'io.github.google/adk-python',
    repoUrl: 'https://github.com/google/adk-python',
  })
  expect('google adk focus repo matches', googleHit?.label === 'Google ADK')

  const baseNoise = matchTrackedProject({
    name: 'io.github.base/paymaster',
    repoUrl: 'https://github.com/base/paymaster',
  })
  expect('generic Base org is not a blanket match', baseNoise === null)
}

{
  const built = buildWireCollection([
    listing({
      name: 'io.github.mastra-ai/mastra',
      title: 'Mastra Wallet Tools',
      description: 'Lets an assistant inspect blockchain wallet data.',
      repoUrl: 'https://github.com/mastra-ai/mastra',
    }),
    listing({
      name: 'io.example/fs',
      description: 'Read local files.',
      publishedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-08-17T10:00:00.000Z',
    }),
    listing({
      name: 'io.example/ads',
      description: 'An advertising campaign manager.',
    }),
  ])
  expect('mastra is SHOW ME', built.showMeCount === 1)
  expect('file connector is routine', built.routineCount === 1)
  expect('ads is filtered', built.filteredCount === 1)
  const mastraRow = built.inbox.find(r => r.name.includes('mastra'))
  expect('mastra has tracked why', !!mastraRow?.whyShown?.includes('tracked'))
  expect('mastra why text names Yesterday’s Builds', (mastraRow?.whyShownText ?? '').includes('Yesterday'))
}

{
  const activeRepo = buildWireCollection([
    listing({
      name: 'uk.co.cybercentry/verification',
      title: 'Cybercentry Verification',
      description: 'Pay-per-call security verification for wallets, contracts, agents and apps.',
      version: '1.0.3',
      status: 'active',
      repoUrl: 'https://github.com/Cybercentry/verification-mcp',
    }),
  ]).inbox[0]
  expect('active listing with repo is SHOW ME crypto', activeRepo.pile === 'show')
  expect(
    'happened line is first appearance, not a repeat of why',
    activeRepo.whatHappened?.includes('first appeared') === true,
  )
  expect(
    'why shown does not repeat what happened',
    !(activeRepo.whyShownText ?? '').includes('first appeared'),
  )
  expect('github display keeps casing', githubRepoDisplay(activeRepo.repoUrl) === 'Cybercentry/verification-mcp')
  expect('publisher is GitHub owner', activeRepo.publisher === 'Cybercentry')
  expect('registry status retained', activeRepo.registryStatus === 'active')
}

{
  const noRepo = buildWireCollection([
    listing({
      name: 'com.example/wallet-bridge',
      description: 'Lets an assistant send payments on ethereum.',
      status: 'active',
    }),
  ]).inbox[0]
  expect('active listing without repo still surfaces on crypto/consequential', noRepo.pile === 'show')
  expect('no repo url', !noRepo.repoUrl)
}

{
  const deprecated = buildWireCollection([
    listing({
      name: 'io.example/old-tool',
      description: 'A filesystem helper.',
      status: 'deprecated',
      statusMessage: 'Use v2 instead.',
    }),
  ]).inbox[0]
  expect('deprecated is SHOW ME', deprecated.pile === 'show')
  expect('deprecated happened copy names Registry', (deprecated.whatHappened ?? '').includes('deprecated'))
  expect('deprecated why is lifecycle, not a repeat of happened', deprecated.whyShownText?.includes('deprecations') === true)
  expect('deprecated statusMessage retained', deprecated.statusMessage === 'Use v2 instead.')
  expect('deprecated is not described as shutdown', !/shut down|no longer works|project is dead/i.test(`${deprecated.whatHappened} ${deprecated.whyShownText}`))
}

{
  const deletedNoted = buildWireCollection([
    listing({
      name: 'systems.entia/entity-verification',
      title: 'ENTIA Entity Verification',
      description: '5.5M verified entities across 10 countries and 13 tools.',
      version: '1.1.1',
      status: 'deleted',
      statusMessage: 'Publisher unpublished this version.',
      repoUrl: 'https://github.com/ENTIA-IA/entia-mcp-server',
    }),
  ]).inbox[0]
  expect('deleted is SHOW ME', deletedNoted.pile === 'show')
  expect('deleted happened copy is Registry lifecycle', deletedNoted.whatHappened?.includes('marks this listing as deleted') === true)
  expect('deleted why is automatic surfacing', deletedNoted.whyShownText?.includes('Registry removals are surfaced automatically') === true)
  expect('statusMessage kept', deletedNoted.statusMessage === 'Publisher unpublished this version.')
  expect('reason line uses supplied message', registryReasonLine(deletedNoted.statusMessage) === 'Publisher unpublished this version.')
  expect(
    'deleted is not project shutdown',
    !/shut down|software is dead|repository was deleted|service stopped/i.test(
      `${deletedNoted.whatHappened} ${deletedNoted.whyShownText}`,
    ),
  )
}

{
  const deletedSilent = buildWireCollection([
    listing({
      name: 'systems.entia/entity-verification',
      description: 'Entity records.',
      version: '1.1.1',
      status: 'deleted',
    }),
  ]).inbox[0]
  expect('missing statusMessage is not invented', deletedSilent.statusMessage === undefined)
  expect('empty reason is explicit', registryReasonLine(deletedSilent.statusMessage) === 'No reason supplied.')
}

{
  const url = officialRegistryRecordUrl('uk.co.cybercentry/verification', '1.0.3')
  expect(
    'receipt encodes registry name',
    url.includes('uk.co.cybercentry%2Fverification') && url.includes('/versions/1.0.3'),
  )
  expect('deleted receipts include include_deleted', url.includes('include_deleted=true'))
  const deletedUrl = officialRegistryRecordUrl('systems.entia/entity-verification', '1.1.1')
  expect('deleted receipt still include_deleted', deletedUrl.includes('include_deleted=true'))
}

{
  const grouped = buildWireCollection([
    listing({
      name: 'io.example/same',
      description: 'A filesystem helper.',
      version: '1.0.0',
      publishedAt: '2026-08-17T10:00:00.000Z',
      updatedAt: '2026-08-17T10:00:00.000Z',
    }),
    listing({
      name: 'io.example/same',
      description: 'A filesystem helper.',
      version: '1.0.1',
      publishedAt: '2026-08-17T10:00:00.000Z',
      updatedAt: '2026-08-17T11:00:00.000Z',
    }),
  ])
  expect('two version rows group to one listing', grouped.rawCount === 2 && grouped.showMeCount + grouped.routineCount + grouped.filteredCount === 1)
  expect('extra version rows accounted for', grouped.extraVersionRows === 1)
}

{
  const related = buildWireCollection([
    listing({
      name: 'systems.entia/entity-verification',
      description: 'Entity records.',
      status: 'deleted',
      repoUrl: 'https://github.com/ENTIA-IA/entia-mcp-server',
    }),
    listing({
      name: 'systems.entia/entity-verification-v2',
      description: 'Entity records v2.',
      status: 'active',
      repoUrl: 'https://github.com/ENTIA-IA/entia-mcp-server',
    }),
  ])
  const a = related.inbox.find(r => r.name.endsWith('entity-verification'))
  const b = related.inbox.find(r => r.name.endsWith('entity-verification-v2'))
  expect(
    'same repo is strong related evidence',
    !!a && !!b && githubRepoDisplay(a.repoUrl) === githubRepoDisplay(b.repoUrl),
  )
}

{
  const yb = readFileSync(join(process.cwd(), 'app/yesterdays-builds/page.tsx'), 'utf8')
  const inbox = readFileSync(join(process.cwd(), 'components/McpWireInbox.tsx'), 'utf8')
  expect('public YB still omits admin on McpWire', /<McpWire wire=\{wire\} \/>/.test(yb))
  expect('inbox does not claim listings are verified safe', !/verified safe|officially approved|widely used/i.test(inbox))
  expect(
    'inbox treats deletion as a Registry event, not a shutdown',
    inbox.includes('does not necessarily mean the underlying project shut down'),
  )
}

{
  expect('hash #wire → admin-wire', resolveAdminSectionId('#wire') === 'admin-wire')
  expect('hash #spotted → admin-spotted', resolveAdminSectionId('#spotted') === 'admin-spotted')
  expect(
    'hash #podcast-review → admin-podcast-review',
    resolveAdminSectionId('#podcast-review') === 'admin-podcast-review',
  )
  expect('hash #utility stays utility', resolveAdminSectionId('#utility') === 'utility')
}

console.log('all mcp-wire checks passed')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
