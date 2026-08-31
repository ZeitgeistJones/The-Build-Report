/**
 * Fail the build if vercel.json would break Vercel Hobby deploys.
 *
 * Hobby allows each cron at most once per day. A schedule like
 * `0 10,14,18,22 * * *` rejects the *entire* deployment and leaves
 * production stuck on an old build (this blanked The Daily Loop for a week).
 *
 * Also asserts Daily Loop GitHub commit pagination stays capped — uncapped
 * pages on high-volume desks burned quota and emptied every other desk.
 *
 * Run: node scripts/check-hobby-crons.mjs
 * Wired into: npm run build
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function fail(msg) {
  console.error(`check-hobby-crons: FAIL — ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`check-hobby-crons: ok — ${msg}`)
}

/** Expand a single cron field into concrete values for one day (Hobby check). */
function expandField(field, min, max) {
  const raw = String(field || '').trim()
  if (!raw || raw === '*') {
    const all = []
    for (let i = min; i <= max; i++) all.push(i)
    return all
  }
  if (raw.includes('/')) {
    const [base, stepRaw] = raw.split('/')
    const step = Number(stepRaw)
    if (!Number.isFinite(step) || step <= 0) fail(`invalid step in cron field "${raw}"`)
    const range =
      base === '*' || base === ''
        ? { lo: min, hi: max }
        : base.includes('-')
          ? { lo: Number(base.split('-')[0]), hi: Number(base.split('-')[1]) }
          : { lo: Number(base), hi: Number(base) }
    const out = []
    for (let i = range.lo; i <= range.hi; i += step) out.push(i)
    return out
  }
  const parts = raw.split(',')
  const out = []
  for (const part of parts) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      for (let i = a; i <= b; i++) out.push(i)
    } else {
      out.push(Number(part))
    }
  }
  return out
}

/** How many times this 5-field cron fires on a generic day (day/month/dow = *). */
function firingsPerDay(schedule) {
  const fields = String(schedule).trim().split(/\s+/)
  if (fields.length !== 5) {
    fail(`cron must have 5 fields (got ${fields.length}): "${schedule}"`)
  }
  const [minute, hour] = fields
  const minutes = expandField(minute, 0, 59)
  const hours = expandField(hour, 0, 23)
  return minutes.length * hours.length
}

const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const crons = Array.isArray(vercel.crons) ? vercel.crons : []
if (crons.length === 0) fail('vercel.json has no crons')

for (const cron of crons) {
  const path = cron?.path
  const schedule = cron?.schedule
  if (!path || !schedule) fail(`cron missing path/schedule: ${JSON.stringify(cron)}`)
  const n = firingsPerDay(schedule)
  if (n > 1) {
    fail(
      `${path} schedule "${schedule}" fires ${n}×/day — Hobby rejects this and blocks ALL deploys. Use one time-of-day (e.g. "0 15 * * *").`,
    )
  }
  ok(`${path} → ${schedule} (${n}×/day)`)
}

const githubSrc = readFileSync(join(root, 'lib/externalOwnerGithub.ts'), 'utf8')
const pageCap = githubSrc.match(/const MAX_COMMIT_PAGES\s*=\s*(\d+)/)
if (!pageCap) fail('MAX_COMMIT_PAGES not found in lib/externalOwnerGithub.ts')
if (Number(pageCap[1]) > 1) {
  fail(
    `MAX_COMMIT_PAGES=${pageCap[1]} — keep at 1. Multi-page commit walks on busy desks (OpenClaw) burn GitHub quota and blank The Daily Loop.`,
  )
}
ok(`MAX_COMMIT_PAGES=${pageCap[1]}`)

const briefSrc = readFileSync(join(root, 'lib/externalOwnerBrief.ts'), 'utf8')
if (briefSrc.includes('batch stopped — consecutive GitHub rate limits (avoid empty paper)')) {
  fail(
    'externalOwnerBrief still aborts the full batch on consecutive rate limits — that blanks later desks',
  )
}
if (!briefSrc.includes('healDailyLoopEdition')) {
  fail('healDailyLoopEdition missing from externalOwnerBrief.ts')
}
ok('batch no longer aborts on consecutive rate limits; healDailyLoopEdition present')

if (!briefSrc.includes('isPublishableExternalBrief')) {
  fail('public brief quality gate is missing from externalOwnerBrief.ts')
}
const paperSrc = readFileSync(
  join(root, 'components/ExternalBriefsNewspaper.tsx'),
  'utf8',
)
if (!paperSrc.includes('isPublishableExternalBrief(r.brief)')) {
  fail('Daily Loop paper does not block template/rate-limited fallback stories')
}
const shareSrc = readFileSync(join(root, 'lib/ybStoryShare.ts'), 'utf8')
if (!shareSrc.includes('isPublishableExternalBrief(brief)')) {
  fail('Daily Loop share pages do not block template/rate-limited fallback stories')
}
ok('public paper and share pages block unfinished fallback stories')

console.log('check-hobby-crons: all good')
