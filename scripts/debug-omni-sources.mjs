async function fetchIpfsText(ipfsUri) {
  const cid = ipfsUri.replace(/^ipfs:\/\//, '')
  for (const base of ['https://dweb.link/ipfs/', 'https://gateway.pinata.cloud/ipfs/']) {
    try {
      const res = await fetch(base + cid, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) continue
      const text = await res.text()
      if (text.trimStart().startsWith('<')) continue
      return text
    } catch {
      // next
    }
  }
  return null
}

const t = await fetchIpfsText('ipfs://QmSduAz7si7qURNWDtxL55A7hJDCjAK38KfTdJQ8TL2DA2')
if (!t) {
  console.log('no text')
  process.exit(0)
}
const lines = t.split('\n').filter(l => l.trim())
const sources = {}
let sample = null
for (const raw of lines.slice(0, 100)) {
  try {
    const o = JSON.parse(raw)
    const key = o.source || '(none)'
    sources[key] = (sources[key] || 0) + 1
    if (!sample && typeof o.text === 'string') {
      sample = { source: o.source, keys: Object.keys(o), text: o.text.slice(0, 60) }
    }
  } catch {
    // skip
  }
}
console.log(JSON.stringify({ lines: lines.length, sources, sample }, null, 2))
