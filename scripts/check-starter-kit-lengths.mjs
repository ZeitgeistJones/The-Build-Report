import { readFileSync } from 'fs'

const URL_W = 23
function weighted(t) {
  const matches = t.match(/https?:\/\/[^\s]+/gi) ?? []
  let length = t.length
  for (const url of matches) length = length - url.length + URL_W
  return length
}

const src = readFileSync('lib/starterKitPosts.ts', 'utf8')
const posts = [...src.matchAll(/id: '([^']+)'[\s\S]*?variants:\s*\[([\s\S]*?)\],\s*\n\s*\},/g)]
let over = 0
let n = 0
for (const [, id, block] of posts) {
  const variants = [...block.matchAll(/`([\s\S]*?)`/g)].map(m => m[1])
  variants.forEach((v, i) => {
    n++
    const L = weighted(v)
    const flag = L > 280 ? 'OVER' : 'ok'
    if (L > 280) over++
    console.log(`${flag} ${id} v${i + 1}: ${L}`)
  })
}
console.log(`total=${n} over=${over}`)
