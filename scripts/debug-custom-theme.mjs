// Automated repro for the custom color theme bug.
// Drives the live Vercel site, exercises the custom theme picker, and reports
// runtime evidence (console logs + computed CSS vars on <html>).
//
// Usage: node scripts/debug-custom-theme.mjs [url]
import { chromium } from 'playwright'

const URL = process.argv[2] || 'https://the-build-report.vercel.app'

function log(...args) {
  console.log('[repro]', ...args)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

page.on('console', msg => {
  const text = msg.text()
  if (text.includes('[custom-debug]')) console.log('[page]', text)
})
page.on('pageerror', err => console.log('[pageerror]', err.message))

async function readThemeState(label) {
  const state = await page.evaluate(() => {
    const el = document.documentElement
    const cs = getComputedStyle(el)
    return {
      inlineStyle: el.getAttribute('style') || '',
      dataColorTheme: el.getAttribute('data-color-theme'),
      computedBg: cs.getPropertyValue('--bg').trim(),
      computedAccent: cs.getPropertyValue('--accent').trim(),
      htmlBg: cs.backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    }
  })
  log(label, JSON.stringify(state))
  return state
}

// React-aware value set: use the native setter so React's controlled input picks it up.
async function setColorInput(selector, value) {
  await page.evaluate(
    ({ selector, value }) => {
      const input = document.querySelector(selector)
      if (!input) return { found: false }
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return { found: true }
    },
    { selector, value },
  )
}

try {
  log('navigating to', URL)
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })

  await readThemeState('initial')

  // Open the theme picker (desktop nav trigger).
  const trigger = page.locator('[aria-label="Color theme"]').first()
  await trigger.waitFor({ state: 'visible', timeout: 15000 })
  await trigger.click()
  log('clicked theme trigger')

  // Click the "Customize..." toggle (matches "Customize" or "Custom (active)").
  const customizeBtn = page.locator('button', { hasText: /Customize|Custom \(active\)/ }).first()
  await customizeBtn.waitFor({ state: 'visible', timeout: 10000 })
  await customizeBtn.click()
  log('clicked Customize')

  // The color inputs should now exist.
  const hasInputs = await page.locator('#custom-bg').count()
  log('custom-bg input count:', hasInputs)

  await readThemeState('before-change')

  // H6: is #custom-bg rendered BELOW the visible fold of the scrollable dropdown?
  const visibility = await page.evaluate(() => {
    const input = document.querySelector('#custom-bg')
    if (!input) return { found: false }
    // Walk up to the scrollable dropdown container.
    let scroller = input.parentElement
    while (scroller && getComputedStyle(scroller).overflowY !== 'auto' && getComputedStyle(scroller).overflowY !== 'scroll') {
      scroller = scroller.parentElement
    }
    const inputRect = input.getBoundingClientRect()
    const scrollRect = scroller ? scroller.getBoundingClientRect() : null
    return {
      found: true,
      inputTop: Math.round(inputRect.top),
      inputBottom: Math.round(inputRect.bottom),
      scrollerVisibleTop: scrollRect ? Math.round(scrollRect.top) : null,
      scrollerVisibleBottom: scrollRect ? Math.round(scrollRect.bottom) : null,
      scrollHeight: scroller?.scrollHeight,
      clientHeight: scroller?.clientHeight,
      scrollTop: scroller?.scrollTop,
      inputBelowFold: scrollRect ? inputRect.top > scrollRect.bottom : null,
    }
  })
  log('H6 visibility:', JSON.stringify(visibility))

  // Change background to a very distinctive red so any effect is unmistakable.
  await setColorInput('#custom-bg', '#ff0000')
  await page.waitForTimeout(300)
  await readThemeState('after-bg-red')
  await page.screenshot({ path: 'scripts/custom-theme-red.png', fullPage: false })
  log('screenshot saved to scripts/custom-theme-red.png')

  // Change accent to bright blue.
  await setColorInput('#custom-accent', '#0000ff')
  await page.waitForTimeout(300)
  await readThemeState('after-accent-blue')

  // Check localStorage persistence.
  const stored = await page.evaluate(() => localStorage.getItem('build-report-custom-theme'))
  log('localStorage custom theme:', stored)
} catch (err) {
  log('ERROR', err.message)
} finally {
  await browser.close()
}
