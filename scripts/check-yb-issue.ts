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
  ybIssueNumber,
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
  canonicalYbIssuePath('2026-08-16') === '/daily-loop?date=2026-08-16',
)

expect('issue 1 is Aug 13', ybIssueNumber('2026-08-13') === 1)
expect('Aug 21 is issue 9', ybIssueNumber('2026-08-21') === 9)
expect('day before the paper has no number', ybIssueNumber('2026-08-12') === null)
expect('old year-count dates have no number', ybIssueNumber('2026-01-01') === null)

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
  const page = readFileSync(join(process.cwd(), 'app/daily-loop/page.tsx'), 'utf8')
  expect('live Daily Loop passes mcpWire', /mcpWire=/.test(page))
  expect('live Daily Loop fetches Wire admin snapshot', page.includes('getMcpWireAdmin'))
  expect('public YB does not pass admin to newspaper', !/ExternalBriefsNewspaper[\s\S]*admin/.test(page))
}

{
  const newspaper = readFileSync(join(process.cwd(), 'components/ExternalBriefsNewspaper.tsx'), 'utf8')
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
  expect('newspaper uses shared issue numbers', newspaper.includes('ybIssueNumber('))
  expect('newspaper does not keep the 2025 year-count epoch', !newspaper.includes('2025, 11, 31'))
  expect('Also filed splits long briefs out of the pack', newspaper.includes('isLongAlsoFiled') && newspaper.includes('ext-paper-shorts-long'))
  expect('Also filed uses paired rows', newspaper.includes('ext-paper-shorts-row--pair'))
  expect('shorts section precedes comic double rule', /ext-paper-shorts[\s\S]*ext-paper-rule--double[\s\S]*DailyLoopComic/.test(newspaper))
  expect('Also filed pair caps at 2 columns', css.includes('.ext-paper-shorts-row--pair') && css.includes('grid-template-columns: 1fr 1fr'))
  expect('long Also filed threshold is 700 chars / 2 paras', newspaper.includes('ALSO_FILED_LONG_CHARS = 700') && newspaper.includes('ALSO_FILED_LONG_PARAS = 2'))
  expect('paper has no Also filed section chip', !newspaper.includes('>Also filed<'))
}

console.log('all yb-issue checks passed')
