// Standalone replica of lib/clawdBurnIndex.ts fetchOnChainBurnTotals, run
// against the public Base Blockscout API. Gives the *live* on-chain CLAWD-burned
// total independently of the app's Redis cache, so we can tell whether the
// homepage's "0" is a clobbered cache or a real on-chain change.
const BLOCKSCOUT_V2 = 'https://base.blockscout.com/api/v2'
const RECEIVER = '0x0C1a3DB07304D2E4E551AB4A7b083382a33f25ad'
const CLAWD = '0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07'.toLowerCase()
const DEAD_TOPIC = '0x000000000000000000000000000000000000000000000000000000000000dead'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const EXECUTE_METHOD_ID = '61461954'
const MAX_TX_PAGES = 10

async function getJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { __err: `HTTP ${res.status}` }
    return await res.json()
  } catch (e) {
    return { __err: String(e) }
  }
}

function isExecuteTx(tx) {
  if (tx.result && tx.result !== 'success' && tx.status && tx.status !== 'ok') return false
  if (tx.method === 'execute') return true
  const input = (tx.raw_input || '').toLowerCase().replace(/^0x/, '')
  return input.startsWith(EXECUTE_METHOD_ID)
}

function clawdToDeadInLogs(logs) {
  let total = 0n
  for (const log of logs) {
    if (log.address?.hash?.toLowerCase() !== CLAWD) continue
    if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) continue
    if (log.topics?.[2]?.toLowerCase() !== DEAD_TOPIC) continue
    const fromDecoded = log.decoded?.parameters?.find(p => p.name === 'value')?.value
    const raw = fromDecoded ?? log.total?.value ?? log.data
    if (!raw) continue
    try { total += BigInt(raw) } catch {}
  }
  return total
}

let total = 0n
let lastBurnAt = null
let cursor
let pages = 0
let executeCount = 0
let firstPageErr = null

while (pages < MAX_TX_PAGES) {
  const url = new URL(`${BLOCKSCOUT_V2}/addresses/${RECEIVER}/transactions`)
  if (cursor) for (const [k, v] of Object.entries(cursor)) if (v != null) url.searchParams.set(k, String(v))
  const page = await getJson(url.toString())
  if (page.__err) { if (pages === 0) firstPageErr = page.__err; break }
  if (!page?.items?.length) break

  console.log(`[burn-scan] page ${pages}: ${page.items.length} txs`)
  for (const tx of page.items) {
    if (!isExecuteTx(tx)) continue
    executeCount++
    const logsPage = await getJson(`${BLOCKSCOUT_V2}/transactions/${tx.hash}/logs`)
    if (logsPage.__err || !logsPage?.items?.length) continue
    total += clawdToDeadInLogs(logsPage.items)
    const ts = tx.timestamp
    if (ts && (!lastBurnAt || ts > lastBurnAt)) lastBurnAt = ts
  }
  pages += 1
  cursor = page.next_page_params ?? null
  if (!cursor) break
}

console.log('[burn-scan] RESULT', JSON.stringify({
  firstPageErr,
  pagesScanned: pages,
  executeTxCount: executeCount,
  clawdBurned: Number(total) / 1e18,
  lastBurnAt,
}))
