/**
 * Yesterday's Builds dated-issue helpers.
 * Run: npx --yes tsx scripts/check-yb-issue.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  canonicalYbIssuePath,
  hasCachedYbEdition,
  parseValidDateKey,
  resolveYbIssueDate,
  shiftDateKey,
  ybIssueNavDates,
} from '../lib/ybIssue'

function expect(name: string, cond: boolean) {
  if (!cond) throw new Error(`FAIL: ${name}`)
  console.log(`ok — ${name}`)
}

expect('valid date parses', parseValidDateKey('2026-08-16') === '2026-08-16')
expect('rejects garbage', parseValidDateKey('nope') === null)
expect('rejects Feb 31', parseValidDateKey('2026-02-31') === null)
expect('rejects empty', parseValidDateKey('') === null)

expect('previous day', shiftDateKey('2026-08-16', -1) === '2026-08-15')
expect('next day', shiftDateKey('2026-08-16', 1) === '2026-08-17')
expect('month roll', shiftDateKey('2026-08-01', -1) === '2026-07-31')

const latest = '2026-08-16'
const none = resolveYbIssueDate(undefined, latest)
expect(
  'no date param uses latest',
  none.ok === true && none.dateKey === latest && none.requested === false,
)
{
  const r = resolveYbIssueDate('2026-08-12', latest)
  expect('explicit date is kept', r.ok && r.dateKey === '2026-08-12' && r.requested === true)
}
expect('invalid does not fall back to latest edition', resolveYbIssueDate('potato', latest).ok === false)
expect('future is rejected', resolveYbIssueDate('2026-08-20', latest).ok === false)
{
  const future = resolveYbIssueDate('2026-08-20', latest)
  expect('future is not silently yesterday', !future.ok && future.reason === 'future')
}

const nav = ybIssueNavDates('2026-08-16', latest)
expect('previous points at prior date', nav.prevDateKey === '2026-08-15')
expect('next hidden on latest', nav.nextDateKey === null)

const older = ybIssueNavDates('2026-08-14', latest)
expect('next points at following date', older.nextDateKey === '2026-08-15')
expect('next cannot pass latest', ybIssueNavDates('2026-08-16', latest).nextDateKey === null)

expect(
  'canonical issue path includes date',
  canonicalYbIssuePath('2026-08-16') === '/yesterdays-builds?date=2026-08-16',
)

expect(
  'empty briefs are not a cached edition',
  hasCachedYbEdition({ gitlawb: null, mastra: null }) === false,
)
expect(
  'non-empty general counts as cached',
  hasCachedYbEdition({
    mastra: {
      general: 'Shipped a thing.',
      text: 'Shipped a thing.',
      dateKey: '2026-08-16',
      isToday: false,
      repoCount: 1,
      commitCount: 2,
      generatedAt: null,
      cards: null,
    },
  }) === true,
)

{
  const page = readFileSync(join(process.cwd(), 'app/yesterdays-builds/page.tsx'), 'utf8')
  expect('live YB does not pass mcpWire', !/mcpWire=/.test(page))
  expect('live YB does not fetch Wire', !page.includes('getMcpWire'))
  expect('public YB does not pass admin to newspaper', !/ExternalBriefsNewspaper[\s\S]*admin/.test(page))
}

console.log('all yb-issue checks passed')
