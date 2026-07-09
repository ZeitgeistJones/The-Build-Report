// Playwright repro for stale "Yesterday's build" brief.
// Usage:
//   node scripts/debug-build-brief.mjs [url] [CRON_SECRET]
// Without CRON_SECRET: scrapes homepage brief only.
// With CRON_SECRET: also hits /api/debug/home-perf for Redis key probe.
import { chromium } from 'playwright'
import { appendFileSync } from 'fs'
import { resolve } from 'path'

const URL = (process.argv[2] || 'https://the-build-report.vercel.app').replace(/\/$/, '')
const CRON_SECRET = process.argv[3] || process.env.CRON_SECRET || ''
const LOG_PATH = resolve(process.cwd(), 'debug-ba045f.log')

function log(...args) {
  console.log('[brief-repro]', ...args)
}

function writeDebugLog(payload) {
  const line = JSON.stringify({
    sessionId: 'ba045f',
    runId: 'playwright-brief',
    timestamp: Date.now(),
    ...payload,
  })
  appendFileSync(LOG_PATH, line + '\n')
  // Also try local ingest (no-op if server down).
  fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'ba045f',
    },
    body: line,
  }).catch(() => {})
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

try {
  log('navigating to', URL)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('.build-brief-card, .build-brief-meta', { timeout: 30000 }).catch(() => null)

  const briefUi = await page.evaluate(() => {
    const card = document.querySelector('.build-brief-card')
    const meta = document.querySelector('.build-brief-meta')
    const title = card?.querySelector('span')?.textContent?.trim() ?? null
    const metaText = meta?.textContent?.replace(/\s+/g, ' ').trim() ?? null
    const body = card?.querySelector('.build-brief-body')?.textContent?.trim()?.slice(0, 240) ?? null
    return { title, metaText, bodyPreview: body, hasCard: Boolean(card) }
  })

  const expected = await page.evaluate(() => {
    const EASTERN_TZ = 'America/New_York'
    const dateKeyEastern = d =>
      new Intl.DateTimeFormat('en-CA', { timeZone: EASTERN_TZ }).format(d)
    const yesterdayEasternDateKey = (now = new Date()) => {
      const todayKey = dateKeyEastern(now)
      let probe = new Date(now.getTime() - 25 * 3600000)
      let key = dateKeyEastern(probe)
      if (key >= todayKey) {
        probe = new Date(probe.getTime() - 24 * 3600000)
        key = dateKeyEastern(probe)
      }
      return key
    }
    const now = new Date()
    return {
      nowIso: now.toISOString(),
      todayEastern: dateKeyEastern(now),
      expectedYesterday: yesterdayEasternDateKey(now),
      expectedPrior: yesterdayEasternDateKey(new Date(Date.now() - 86400000)),
    }
  })

  log('brief UI', JSON.stringify(briefUi))
  log('expected keys', JSON.stringify(expected))
  writeDebugLog({
    hypothesisId: 'C',
    location: 'scripts/debug-build-brief.mjs:homepage',
    message: 'playwright scraped homepage brief',
    data: { url: URL, briefUi, expected },
  })

  if (!CRON_SECRET) {
    log('no CRON_SECRET — skipping home-perf. Pass as argv[3] or env CRON_SECRET.')
  } else {
    const perfUrl = `${URL}/api/debug/home-perf?key=${encodeURIComponent(CRON_SECRET)}`
    log('fetching home-perf')
    const res = await page.goto(perfUrl, { waitUntil: 'domcontentloaded', timeout: 120000 })
    const status = res?.status() ?? 0
    const text = await page.locator('body').innerText()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      json = { parseError: true, preview: text.slice(0, 400) }
    }
    const slim = {
      status,
      briefDateKey: json?.briefDateKey ?? null,
      briefGeneratedAt: json?.briefGeneratedAt ?? null,
      briefDebug: json?.briefDebug ?? null,
      hasBrief: json?.hasBrief ?? null,
      error: json?.error ?? null,
    }
    log('home-perf', JSON.stringify(slim, null, 2))
    writeDebugLog({
      hypothesisId: 'A',
      location: 'scripts/debug-build-brief.mjs:home-perf',
      message: 'playwright fetched home-perf briefDebug',
      data: slim,
    })
  }
} finally {
  await browser.close()
}
