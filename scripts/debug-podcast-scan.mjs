/**
 * Hit admin podcast-mentions with temporary debug payload.
 * Usage:
 *   node scripts/debug-podcast-scan.mjs [baseUrl] [adminPassword]
 * Defaults: production URL; password from ADMIN_PASSWORD env.
 */
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const baseUrl = (process.argv[2] || 'https://the-build-report.vercel.app').replace(/\/$/, '')
const password = process.argv[3] || process.env.ADMIN_PASSWORD

if (!password) {
  console.error('Missing ADMIN_PASSWORD (arg 2 or env)')
  process.exit(1)
}

const endpoint = `${baseUrl}/api/admin/podcast-mentions`
console.log('[podcast-debug] POST', endpoint)

const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password }),
  signal: AbortSignal.timeout(180_000),
})

const text = await res.text()
let data
try {
  data = JSON.parse(text)
} catch {
  console.error('[podcast-debug] non-JSON', res.status, text.slice(0, 500))
  process.exit(1)
}

const summary = {
  status: res.status,
  ok: data.ok,
  error: data.error ?? null,
  scanned: data.scanned,
  mentionsFound: data.mentionsFound,
  mode: data.mode,
  totalEpisodesOnChain: data.totalEpisodesOnChain,
  debugCount: Array.isArray(data.debug) ? data.debug.length : 0,
  debug: data.debug ?? null,
}

console.log('[podcast-debug] summary', JSON.stringify({
  status: summary.status,
  ok: summary.ok,
  error: summary.error,
  scanned: summary.scanned,
  mentionsFound: summary.mentionsFound,
  mode: summary.mode,
  totalEpisodesOnChain: summary.totalEpisodesOnChain,
  debugCount: summary.debugCount,
}, null, 2))

if (summary.debug) {
  for (const ep of summary.debug) {
    console.log(
      '[podcast-debug] ep',
      JSON.stringify({
        name: ep.name,
        slug: ep.slug,
        hasManifest: ep.hasManifest,
        manifestFetched: ep.manifestFetched,
        manifestKeys: ep.manifestKeys,
        transcriptUri: ep.transcriptUri,
        transcriptLineCount: ep.transcriptLineCount,
      }),
    )
  }
}

const outPath = join(root, 'debug-ba045f.log')
const line = JSON.stringify({
  sessionId: 'ba045f',
  location: 'scripts/debug-podcast-scan.mjs',
  message: 'podcast scan debug response',
  data: summary,
  timestamp: Date.now(),
  hypothesisId: 'H1-H5',
})
writeFileSync(outPath, line + '\n')
console.log('[podcast-debug] wrote', outPath)
