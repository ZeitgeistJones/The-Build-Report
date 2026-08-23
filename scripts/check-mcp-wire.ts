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
import { toPublicWireDispatch } from '../lib/mcpWirePublic'

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

/* 6. Live Yesterday's Builds hides The Wire; Admin keeps inbox + desk preview. */
{
  const yb = readFileSync(join(process.cwd(), 'app/daily-loop/page.tsx'), 'utf8')
  const mcp = readFileSync(join(process.cwd(), 'components/McpWire.tsx'), 'utf8')
  const adminPage = readFileSync(join(process.cwd(), 'app/admin/page.tsx'), 'utf8')
  expect('live YB does not pass mcpWire', !/mcpWire=/.test(yb))
  expect('live YB does not fetch Wire', !yb.includes('getMcpWire'))
  expect('desk preview is not the inbox', !mcp.includes('SHOW ME') && !mcp.includes('ROUTINE UPDATES'))
  expect('desk preview has no SHUT DOWN label', !mcp.includes('SHUT DOWN'))
  expect('admin page still mounts Wire Inbox', adminPage.includes('<McpWireInbox record={wireAdmin} />'))
  expect('admin page still mounts desk preview', adminPage.includes('<McpWire wire={wireAdmin?.snapshot ?? null} preview />'))
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
  expect('mastra why text names The Daily Loop', (mastraRow?.whyShownText ?? '').includes('The Daily Loop'))
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
  const inbox = readFileSync(join(process.cwd(), 'components/McpWireInbox.tsx'), 'utf8')
  expect('admin inbox still has SHOW ME / ROUTINE / FILTERED piles', inbox.includes('SHOW ME') && inbox.includes('ROUTINE UPDATES') && inbox.includes('FILTERED / NOISE'))
  expect(
    'inbox treats deletion as a Registry event, not a shutdown',
    inbox.includes('does not necessarily mean the underlying project shut down'),
  )
}

/* 7. Public newspaper selection + copy fixtures. */
{
  const onchainRepo = buildWireCollection([
    listing({
      name: 'io.example/cybercentry',
      title: 'Cybercentry Verification',
      description: 'Pay-per-call verification for wallets, contracts and agent applications.',
      repoUrl: 'https://github.com/example/cybercentry',
      publishedAt: '2026-08-18T07:24:03.000Z',
      updatedAt: '2026-08-18T07:24:03.000Z',
    }),
  ])
  const onchainDispatch = toPublicWireDispatch(onchainRepo.items[0])
  expect('1. new onchain with repo is public', onchainRepo.items.length === 1 && onchainDispatch.status === 'NEW' && onchainDispatch.beat === 'ONCHAIN')
  expect('1. compact UTC stamp, no seconds', onchainDispatch.time === '07:24 UTC')
  expect('1. source repo receipt present', onchainDispatch.repoUrl === 'https://github.com/example/cybercentry')
  expect(
    '1. registry receipt is official',
    officialRegistryRecordUrl(onchainDispatch.name, onchainDispatch.version).includes('/servers/') &&
      officialRegistryRecordUrl(onchainDispatch.name, onchainDispatch.version).includes('include_deleted=true'),
  )

  const onchainNoRepo = buildWireCollection([
    listing({
      name: 'io.example/wallet-brief',
      title: 'Wallet Brief',
      description: 'A crypto wallet helper for agents.',
      publishedAt: '2026-08-18T08:00:00.000Z',
      updatedAt: '2026-08-18T08:00:00.000Z',
    }),
  ])
  const noRepoDispatch = toPublicWireDispatch(onchainNoRepo.items[0])
  expect('2. new listing without repo still prints', onchainNoRepo.items.length === 1 && !noRepoDispatch.repoUrl)
  expect('2. registry receipt still exists', Boolean(officialRegistryRecordUrl(noRepoDispatch.name, noRepoDispatch.version)))

  const deprecated = buildWireCollection([
    listing({
      name: 'io.example/old-wallet',
      title: 'Old Wallet',
      description: 'Legacy crypto wallet connector.',
      status: 'deprecated',
      publishedAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-08-18T09:00:00.000Z',
    }),
  ])
  const deprecatedDispatch = toPublicWireDispatch(deprecated.items[0])
  expect('3. deprecated uses DEPRECATED', deprecatedDispatch.status === 'DEPRECATED')
  expect(
    '3. deprecated copy is Registry language',
    deprecatedDispatch.sentence === 'The official MCP Registry now marks this listing as deprecated.',
  )

  const deletedRepo = buildWireCollection([
    listing({
      name: 'systems.entia/entity-verification',
      title: 'ENTIA Entity Verification',
      description: '5.5M verified entities across business-data sources.',
      status: 'deleted',
      repoUrl: 'https://github.com/ENTIA-IA/entia-mcp-server',
      publishedAt: '2026-08-01T06:50:00.000Z',
      updatedAt: '2026-08-18T06:50:00.000Z',
    }),
  ])
  const deletedDispatch = toPublicWireDispatch(deletedRepo.items[0])
  expect('4. deleted uses REMOVED FROM REGISTRY', deletedDispatch.status === 'REMOVED FROM REGISTRY')
  expect(
    '4. deleted copy is Registry language, not shutdown',
    deletedDispatch.sentence === 'The official MCP Registry now marks this listing as deleted.' &&
      deletedDispatch.deletionNote &&
      !deletedDispatch.sentence.toLowerCase().includes('shut down'),
  )
  expect('4. deleted with repo keeps Source receipt', Boolean(deletedDispatch.repoUrl))

  const deletedNoRepo = buildWireCollection([
    listing({
      name: 'io.example/gone',
      title: 'Gone Tool',
      description: 'A connector that used to list wallets.',
      status: 'deleted',
      publishedAt: '2026-08-01T06:00:00.000Z',
      updatedAt: '2026-08-18T06:00:00.000Z',
    }),
  ])
  expect('5. deleted without repo still prints Registry receipt only', deletedNoRepo.items.length === 1 && !toPublicWireDispatch(deletedNoRepo.items[0]).repoUrl)

  const tracked = buildWireCollection([
    listing({
      name: 'io.github.mastra-ai/mastra',
      title: 'Mastra',
      description: 'Agent workflow tools from the Mastra project.',
      repoUrl: 'https://github.com/mastra-ai/mastra',
      publishedAt: '2026-08-18T05:00:00.000Z',
      updatedAt: '2026-08-18T05:00:00.000Z',
    }),
  ])
  const trackedDispatch = toPublicWireDispatch(tracked.items[0])
  expect('6. tracked-project match prints', tracked.items.length === 1 && trackedDispatch.trackedNote)

  const crowded = buildWireCollection(
    [12, 11, 10, 9, 8, 7].map(hour =>
      listing({
        name: `io.example/wallet-${String(hour).padStart(2, '0')}`,
        title: `Wallet ${hour}`,
        description: 'A crypto wallet helper for agents.',
        publishedAt: `2026-08-18T${String(hour).padStart(2, '0')}:00:00.000Z`,
        updatedAt: `2026-08-18T${String(hour).padStart(2, '0')}:00:00.000Z`,
      }),
    ),
  )
  expect('7. public prints at most 2', crowded.items.length === 2 && crowded.showMeCount === 6)
  expect(
    '7. newer timestamps win the cap',
    crowded.items.every(item => item.name !== 'io.example/wallet-07'),
  )

  const quiet = buildWireCollection([
    listing({
      name: 'io.example/calendar',
      title: 'Calendar',
      description: 'Let an assistant read a calendar.',
      repoUrl: 'https://github.com/example/calendar',
    }),
  ])
  expect('8. quiet day prints nothing public', quiet.items.length === 0 && quiet.routineCount === 1)

  const twins = buildWireCollection([
    listing({
      name: 'systems.entia/entity-verification',
      title: 'ENTIA Entity Verification',
      description: 'Identity verification for wallets and contracts.',
      repoUrl: 'https://github.com/ENTIA-IA/entia-mcp-server',
      publishedAt: '2026-08-18T06:00:00.000Z',
      updatedAt: '2026-08-18T06:00:00.000Z',
    }),
    listing({
      name: 'systems.entia/entity-verification-v2',
      title: 'ENTIA Entity Verification v2',
      description: 'Identity verification for wallets and contracts, v2.',
      repoUrl: 'https://github.com/ENTIA-IA/entia-mcp-server',
      publishedAt: '2026-08-18T06:10:00.000Z',
      updatedAt: '2026-08-18T06:10:00.000Z',
    }),
  ])
  expect('9. same source repo collapses in public', twins.items.length === 1)
  expect('9. admin inbox still shows both', twins.inbox.filter(r => r.pile === 'show').length === 2)

  const claimed = buildWireCollection([
    listing({
      name: 'io.example/entia-claim',
      title: 'ENTIA Claim',
      description: '5.5M verified entities spanning business-data sources for wallet checks.',
      publishedAt: '2026-08-18T04:00:00.000Z',
      updatedAt: '2026-08-18T04:00:00.000Z',
    }),
  ])
  const claimedDispatch = toPublicWireDispatch(claimed.items[0])
  expect(
    '10. publisher metrics are attributed',
    claimedDispatch.sentence.startsWith('The Registry listing describes it as:') &&
      !claimedDispatch.sentence.startsWith('5.5M verified entities'),
  )
  expect(
    '24. public copy does not treat Registry presence as safety',
    !/safe|trusted|approved|endorsed|widely used/.test(claimedDispatch.sentence),
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
