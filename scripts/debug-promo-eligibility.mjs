// Compare promo eligibility vs live commit counts on production (or local dev).
// Usage:
//   node scripts/debug-promo-eligibility.mjs [baseUrl] [cronSecret]
//   node scripts/debug-promo-eligibility.mjs https://the-build-report.vercel.app YOUR_CRON_SECRET
//   node scripts/debug-promo-eligibility.mjs http://localhost:3000 YOUR_CRON_SECRET slop-circle

const baseUrl = (process.argv[2] || 'https://the-build-report.vercel.app').replace(/\/$/, '')
const cronSecret = process.argv[3]
const slug = process.argv[4]

if (!cronSecret) {
  console.error('Usage: node scripts/debug-promo-eligibility.mjs [baseUrl] <cronSecret> [slug]')
  process.exit(1)
}

const params = new URLSearchParams({ key: cronSecret })
if (slug) params.set('slug', slug)

const url = `${baseUrl}/api/debug/promo-eligibility?${params.toString()}`

const res = await fetch(url, { cache: 'no-store' })
const text = await res.text()

if (!res.ok) {
  console.error(`[promo-eligibility] HTTP ${res.status}`)
  console.error(text)
  process.exit(1)
}

const data = JSON.parse(text)
console.log('[promo-eligibility]', JSON.stringify(data, null, 2))

if (data.mismatchCount > 0) {
  console.error(`\n[promo-eligibility] WARNING: ${data.mismatchCount} repo(s) with card/promo mismatch`)
  process.exit(2)
}

console.log('\n[promo-eligibility] OK — no cached-vs-live promo mismatches in sample')
