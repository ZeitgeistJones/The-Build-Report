/**
 * Mine UNIVERSAL jargon from live score explanations (no paste required).
 *
 * Default sources (in order):
 *   1. Production /api/debug/score-blurbs  (needs CRON_SECRET in env)
 *   2. Redis autoscores                   (needs UPSTASH_REDIS_REST_*)
 *   3. lib score-adjacent quoted strings
 *   4. Optional fixture / --file (offline only)
 *
 * Usage:
 *   Put CRON_SECRET in .env.cron.local once (Vercel dashboard → copy).
 *   Sensitive vars are NOT available via `vercel env pull` / `vercel env run`.
 *   npm run scan:dictionary
 *   npm run scan:dictionary -- --site https://the-build-report.vercel.app
 *
 * Env: CRON_SECRET (required for live pull), optional DICTIONARY_SCAN_SITE
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const root = join(fileURLToPath(import.meta.url), '..', '..')
const require = createRequire(import.meta.url)

// Prefer cron-local (real secret). Ignore .env.local if it only has Vercel [SENSITIVE] stubs.
loadEnvFile(join(root, '.env.cron.local'))
loadEnvFile(join(root, '.env.local'), { skipPlaceholders: true })
loadEnvFile(join(root, '.env'), { skipPlaceholders: true })

const args = process.argv.slice(2)
const limit = Number(args.find((a, i) => args[i - 1] === '--limit') ?? 60)
const requireRedis = args.includes('--redis')
const includeDocs = args.includes('--docs')
const offline = args.includes('--offline')
const useFixture = args.includes('--fixture')
const siteArg = args.find((a, i) => args[i - 1] === '--site')
const extraFiles = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) extraFiles.push(args[++i])
}

function loadEnvFile(path, opts = {}) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (opts.skipPlaceholders && /^\[?SENSITIVE\]?$/i.test(val)) continue
    if (!val) continue
    if (!process.env[key]) process.env[key] = val
  }
}

/** Phrases / tokens holders often hit in score blurbs (case-insensitive). */
const LEXICON = [
  // crypto
  'burn',
  'burns',
  'supply-lock',
  'supply lock',
  'on-chain',
  'onchain',
  'smart contract',
  'smart contracts',
  'ERC-8004',
  'ERC20',
  'ERC-20',
  'USDC',
  'ETH',
  'Base',
  'RPC',
  'mempool',
  'gas',
  'wallet',
  'staking',
  'staked',
  'tokenomics',
  'token-economics',
  'token economics',
  'admin keys',
  'admin key',
  'multisig',
  'immutable',
  'buy-and-burn',
  'buy and burn',
  'liquidity',
  'TVL',
  'oracle',
  'mainnet',
  'testnet',
  'abi',
  'calldata',
  // github
  'README',
  'CHANGELOG',
  'LICENSE',
  'SECURITY.md',
  'AGENTS.md',
  'commit',
  'commits',
  'push',
  'pushed',
  'repo',
  'repos',
  'repository',
  'org',
  'organization',
  'pull request',
  'PR',
  'gitignored',
  'gitignore',
  'root files',
  'monorepo',
  // coding
  'CI',
  'CI/CD',
  'CD',
  'test suite',
  'unit test',
  'integration test',
  'lockfile',
  'package.json',
  'package-lock',
  'pnpm-lock',
  'yarn.lock',
  'stdlib',
  'typescript',
  'javascript',
  'rust',
  'golang',
  'open source',
  'open-source',
  'security audit',
  'audit',
  'versioning',
  'semver',
  'sdk',
  'api',
  'cli',
  'toolchain',
  'linter',
  'eslint',
  'prettier',
  'dependency',
  'dependencies',
  'npm',
  'bytecode',
  'cryptographic',
  'cryptography',
  // ai
  'agent',
  'agents',
  'LLM',
  'LLMs',
  'Ollama',
  'whisper.cpp',
  'Whisper',
  'sherpa-onnx',
  'MCP',
  'Claude Code',
  'Claude',
  'prompt',
  'prompts',
  'system prompt',
  'fine-tune',
  'inference',
  'embedding',
  'embeddings',
  'OCR',
  'ScreenCaptureKit',
  // ops
  'VM',
  'VMs',
  'virtual machine',
  'tart',
  'Docker',
  'container',
  'containers',
  'orchestration',
  'orchestrator',
  'infrastructure',
  'infra',
  'daemon',
  'bootstrap',
  'provision',
  'provisioning',
  'ephemeral',
  'chmod',
  '.env',
  'secrets',
  'keychain',
  'OAuth',
  'API key',
  'rate limit',
  'cron',
  'polling',
  'Apple Silicon',
  'macOS',
  'Mac mini',
  'gold image',
  'gold-image',
  'host-side',
  'isolation',
  'isolated',
  'process-isolated',
  'process isolation',
  'critical path',
  'provisioning',
  'provision',
  'polling',
  'polls',
  'boot-on-demand',
  'chmod',
  'chmod 600',
  'keychain',
  'OAuth',
  'payment settlement',
  'job pickup',
  'agent fleet',
  'execution engine',
  'ENS',
  '.eth',
  'skills',
  'ethskills',
  'CLI',
  'container orchestration',
  'privilege escalation',
  'auditable',
  'runtime',
  'mutable',
]

const STOP = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'is',
  'are',
  'was',
  'were',
  'be',
  'this',
  'that',
  'with',
  'from',
  'as',
  'by',
  'it',
  'its',
  'at',
  'not',
  'no',
  'yes',
  'high',
  'mid',
  'low',
  'new',
  'old',
])

/** Product / ecosystem proper nouns — never suggest these for the universal dictionary. */
const ECOSYSTEM_BLOCK = [
  /^clawd/i,
  /leftclaw/i,
  /clawdbot/i,
  /\$clawd/i,
  /pay\.clawd/i,
  /ethskills/i,
  /agent-wrangler/i,
  /bake-agent-gold/i,
  /provision\w*agent/i,
]

function walkFiles(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkFiles(p, out)
    else if (/\.(ts|tsx|md|mjs|js)$/.test(name)) out.push(p)
  }
  return out
}

function loadExistingDictionary() {
  const path = join(root, 'lib', 'dictionary.ts')
  const text = readFileSync(path, 'utf8')
  const ids = new Set()
  const terms = new Set()
  for (const m of text.matchAll(/id:\s*'([^']+)'/g)) ids.add(m[1].toLowerCase())
  for (const m of text.matchAll(/term:\s*'([^']+)'/g)) {
    terms.add(m[1].toLowerCase())
    // also bare words from multi-word terms
    for (const w of m[1].toLowerCase().split(/[^a-z0-9.$+-]+/)) {
      if (w.length >= 2) terms.add(w)
    }
  }
  return { ids, terms }
}

function extractQuotedBlobs(fileText) {
  const blobs = []
  // source: '...', verdict: "...", long template strings
  const re = /(?:source|verdict|normieVerdict|adminNote|definition|short|body|blurb|subtitle|description|framing|tooltip|content)\s*[:=]\s*(`(?:\\`|[^`])*`|'(?:\\'|[^'])*'|"(?:\\"|[^"])*")/gi
  let m
  while ((m = re.exec(fileText))) {
    let raw = m[1]
    if (raw.startsWith('`')) raw = raw.slice(1, -1)
    else raw = raw.slice(1, -1)
    raw = raw.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"')
    if (raw.length >= 40) blobs.push(raw)
  }
  return blobs
}

function collectFixtureBlurbs() {
  const paths = [
    join(root, 'scripts', 'fixtures', 'score-blurbs-sample.txt'),
    ...extraFiles.map(p => (p.startsWith('/') || /^[A-Za-z]:/.test(p) ? p : join(root, p))),
  ]
  const chunks = []
  for (const path of paths) {
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    // Split on --- headers; drop comments and accidental shell commands
    const blocks = text
      .split(/\n(?=--- )/)
      .map(b =>
        b
          .split('\n')
          .filter(line => {
            const t = line.trim()
            if (!t || t.startsWith('#')) return false
            if (/^npm\s+run\b/i.test(t)) return false
            if (/^node\s+/i.test(t)) return false
            return true
          })
          .join('\n')
          .trim(),
      )
      .filter(b => b.length >= 40)
    for (const block of blocks) {
      chunks.push({ source: relative(root, path), text: block })
    }
  }
  return chunks
}

function collectRepoText() {
  // Score-adjacent code only by default — docs/ is reference noise.
  const files = [
    ...walkFiles(join(root, 'lib')),
    ...walkFiles(join(root, 'components')),
    ...(includeDocs ? walkFiles(join(root, 'docs')) : []),
  ]
  const prefer = /(?:scores|cardFraming|badgeTooltips|rubric|autoscore|scoring)/i
  const chunks = []
  for (const file of files) {
    const rel = relative(root, file).replace(/\\/g, '/')
    if (rel === 'lib/dictionary.ts') continue
    const text = readFileSync(file, 'utf8')
    const blobs = extractQuotedBlobs(text)
    // Prefer files that actually hold score blurbs; elsewhere keep only long source-like blobs
    for (const blob of blobs) {
      if (!prefer.test(rel) && blob.length < 120) continue
      chunks.push({ source: rel, text: blob })
    }
    if (includeDocs && file.endsWith('.md')) {
      chunks.push({ source: rel, text })
    }
  }
  return chunks
}

async function collectLiveSiteBlurbs() {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return []

  const base =
    siteArg?.replace(/\/$/, '') ||
    process.env.DICTIONARY_SCAN_SITE?.replace(/\/$/, '') ||
    'https://the-build-report.vercel.app'

  const url = `${base}/api/debug/score-blurbs?key=${encodeURIComponent(secret)}`
  console.log(`[scan] fetching live blurbs from ${base}/api/debug/score-blurbs …`)
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`live pull HTTP ${res.status}: ${body.slice(0, 180)}`)
  }
  const data = await res.json()
  const texts = Array.isArray(data.texts)
    ? data.texts
    : Array.isArray(data.blurbs)
      ? data.blurbs.map(b => b.text).filter(Boolean)
      : []
  return texts
    .filter(t => typeof t === 'string' && t.trim().length >= 20)
    .map(text => ({ source: `live:${base}`, text }))
}

async function collectRedisText() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    if (requireRedis) {
      throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN required with --redis')
    }
    return []
  }

  let Redis
  try {
    ;({ Redis } = require('@upstash/redis'))
  } catch {
    console.warn('[scan] @upstash/redis not available; skipping Redis')
    return []
  }

  const r = new Redis({ url, token })
  const prefix = 'build-report:autoscore:v3:'
  const keys = await r.keys(`${prefix}*`)
  const chunks = []
  // batch get
  const batchSize = 50
  for (let i = 0; i < keys.length; i += batchSize) {
    const slice = keys.slice(i, i + batchSize)
    const values = await r.mget(...slice)
    for (let j = 0; j < slice.length; j++) {
      const repo = values[j]
      if (!repo || typeof repo !== 'object') continue
      const slug = slice[j].replace(prefix, '')
      const texts = []
      if (typeof repo.verdict === 'string') texts.push(repo.verdict)
      if (typeof repo.normieVerdict === 'string') texts.push(repo.normieVerdict)
      for (const score of [repo.shippingLeverage, repo.tokenMechanic, repo.builderIntegrity]) {
        if (!score?.rubric) continue
        for (const row of score.rubric) {
          if (typeof row.source === 'string') texts.push(row.source)
          if (typeof row.sourceNormie === 'string') texts.push(row.sourceNormie)
        }
      }
      for (const t of texts) {
        if (t.trim().length >= 20) chunks.push({ source: `redis:${slug}`, text: t })
      }
    }
  }
  return chunks
}

function normalizeKey(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function isEcosystemSpecific(key) {
  const k = normalizeKey(key)
  return ECOSYSTEM_BLOCK.some(re => re.test(k))
}

function alreadyCovered(key, existing) {
  const k = normalizeKey(key)
  if (isEcosystemSpecific(k)) return true
  if (existing.terms.has(k)) return true
  const slug = k.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (existing.ids.has(slug)) return true

  // Filename scripts / one-off repo files — not universal dictionary material
  if (/\.(sh|js|mjs|py|json)$/.test(k) && !/^(package\.json|package-lock\.json|tsconfig\.json|yarn\.lock)$/.test(k)) {
    return true
  }
  if (/\.(md)$/.test(k) && !/^(readme|license|changelog|security|governance|contributing|agents|claude)\.md$/.test(k)) {
    return true
  }

  const variants = new Set([
    k,
    k.replace(/s$/, ''),
    k.replace(/ed$/, ''),
    k.replace(/ing$/, ''),
    k.replace(/ies$/, 'y'),
    k.replace(/process-isolated/, 'process-isolation'),
    k.replace(/\bisolated\b/, 'isolation'),
    k.replace(/\bpolls\b/, 'polling'),
    k.replace(/\bstaked\b/, 'staking'),
    k.replace(/\borchestrator\b/, 'orchestration'),
    k.replace(/test suite/, 'tests'),
  ])

  for (const v of variants) {
    if (existing.terms.has(v)) return true
    const vs = v.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (existing.ids.has(vs)) return true
  }

  for (const id of existing.ids) {
    const idWords = id.replace(/-/g, ' ')
    if (k.includes(idWords) || idWords.includes(k)) return true
    for (const v of variants) {
      if (v.includes(idWords) || idWords.includes(v)) return true
    }
  }
  // Any dictionary term string containing this key (e.g. "staked" in "Staking / staked")
  for (const t of existing.terms) {
    if (t.includes(k) || k.includes(t)) {
      if (k.length >= 4 && t.length >= 4) return true
    }
  }
  return false
}

function findLexiconHits(text, counts, examples) {
  const lower = text.toLowerCase()
  for (const phrase of LEXICON) {
    const p = phrase.toLowerCase()
    let idx = 0
    let n = 0
    while ((idx = lower.indexOf(p, idx)) !== -1) {
      // Always require word-ish boundaries (avoids "rust" inside "trust").
      const before = lower[idx - 1]
      const after = lower[idx + p.length]
      const okBefore = idx === 0 || /[^a-z0-9]/.test(before ?? '')
      const okAfter = !after || /[^a-z0-9./]/.test(after)
      if (!okBefore || !okAfter) {
        idx += p.length
        continue
      }
      n++
      idx += p.length
    }
    if (n > 0) {
      const key = normalizeKey(phrase)
      counts.set(key, (counts.get(key) ?? 0) + n)
      if (!examples.has(key)) examples.set(key, [])
      const list = examples.get(key)
      if (list.length < 2) {
        const start = Math.max(0, lower.indexOf(p) - 40)
        list.push(text.slice(start, start + 120).replace(/\s+/g, ' ').trim())
      }
    }
  }
}

function findTechTokens(text, counts, examples) {
  // file.ext, dotted libs, kebab scripts, CamelCase tools
  const patterns = [
    // Notable doc/config filenames only (skip long random doc paths).
    /\b(?:README|LICENSE|CHANGELOG|SECURITY|GOVERNANCE|CONTRIBUTING|AGENTS|CLAUDE)\.md\b/gi,
    /\b[a-z][\w-]*\.(?:cpp|sh|ts|tsx|js|json|yml|yaml|toml)\b/gi,
    /\b(?:package|yarn|pnpm)-lock(?:\.\w+)?\b/gi,
    /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g, // ScreenCaptureKit, AppleSilicon-ish
    /\b[a-z]+(?:-[a-z0-9]+){1,4}\.(?:sh|md)\b/gi,
  ]
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const raw = m[0]
      if (raw.length < 4 || raw.length > 48) continue
      const key = normalizeKey(raw)
      if (STOP.has(key)) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
      if (!examples.has(key)) examples.set(key, [])
      const list = examples.get(key)
      if (list.length < 2) {
        list.push(text.slice(Math.max(0, m.index - 30), m.index + raw.length + 50).replace(/\s+/g, ' ').trim())
      }
    }
  }
}

async function main() {
  const existing = loadExistingDictionary()
  console.log(
    `[scan] dictionary already has ${existing.ids.size} ids / ${existing.terms.size} term tokens`,
  )

  const chunks = []

  if (!offline) {
    try {
      const live = await collectLiveSiteBlurbs()
      console.log(`[scan] live site blurbs: ${live.length}`)
      chunks.push(...live)
    } catch (err) {
      console.warn('[scan] live site pull failed:', err instanceof Error ? err.message : err)
      if (!process.env.CRON_SECRET) {
        console.warn(
          '[scan] tip: run `vercel env pull .env.local` once so CRON_SECRET is available — no paste needed.',
        )
      }
    }

    try {
      const redisChunks = await collectRedisText()
      console.log(`[scan] redis score chunks: ${redisChunks.length}`)
      chunks.push(...redisChunks)
    } catch (err) {
      console.error('[scan] redis error:', err instanceof Error ? err.message : err)
      if (requireRedis) process.exit(1)
    }
  } else {
    console.log('[scan] offline mode — skipping live site + Redis')
  }

  if (useFixture || offline || extraFiles.length || chunks.length === 0) {
    const fixtureChunks = collectFixtureBlurbs()
    console.log(`[scan] fixture/file blurbs: ${fixtureChunks.length}`)
    chunks.push(...fixtureChunks)
  }

  const repoChunks = collectRepoText()
  console.log(`[scan] repo text chunks: ${repoChunks.length}${includeDocs ? ' (docs ON)' : ' (docs OFF)'}`)
  chunks.push(...repoChunks)

  const counts = new Map()
  const examples = new Map()
  const sources = new Map()

  for (const { source, text } of chunks) {
    findLexiconHits(text, counts, examples)
    findTechTokens(text, counts, examples)
    for (const [key, n] of counts) {
      // track source lightly — only bump when this chunk contributed
      // (cheap: if example was just set from this text)
    }
    void source
  }

  // Re-scan for sources properly
  for (const { source, text } of chunks) {
    const lower = text.toLowerCase()
    for (const key of counts.keys()) {
      if (lower.includes(key)) {
        if (!sources.has(key)) sources.set(key, new Set())
        sources.get(key).add(source.split(':')[0] === 'redis' ? 'redis' : 'repo')
      }
    }
  }

  const rows = [...counts.entries()]
    .map(([key, count]) => ({
      key,
      count,
      covered: alreadyCovered(key, existing),
      where: [...(sources.get(key) ?? [])].join('+') || '?',
      example: (examples.get(key) ?? [])[0] ?? '',
    }))
    .filter(r => !r.covered)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit)

  console.log(`\n[scan] top ${rows.length} candidates NOT in dictionary yet:\n`)
  console.log(
    `${'count'.padStart(5)}  ${'term'.padEnd(28)}  ${'where'.padEnd(10)}  example`,
  )
  console.log('-'.repeat(100))
  for (const r of rows) {
    const ex = r.example.length > 70 ? `${r.example.slice(0, 67)}…` : r.example
    console.log(`${String(r.count).padStart(5)}  ${r.key.padEnd(28)}  ${r.where.padEnd(10)}  ${ex}`)
  }

  console.log(`\n[scan] tip: add winners to lib/dictionary.ts with id + [[cross-refs]], then re-run.`)
  if (!process.env.CRON_SECRET) {
    console.log(
      '[scan] tip: create .env.cron.local with CRON_SECRET=<from Vercel dashboard> then re-run — pulls all live score blurbs, no paste.',
    )
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
