/** Client-side branded PNG cards for X share (admin tool). */

import { TBR_SITE_URL } from '@/lib/xSharePosts'

const ACCENT = '#3D9A88'
const BG_TOP = '#0E1414'
const BG_BOTTOM = '#16201E'
const TEXT = '#FFFFFF'
const MUTED = '#8FA39D'
const BODY = '#C7D2CE'

const WIDTH = 1200
const MIN_HEIGHT = 675
const MAX_HEIGHT = 1600
const PAD = 64
const FOOTER = 'the-build-report.vercel.app'

export type ShareImageKind = 'brief' | 'needle'

export type ShareImageInput = {
  kind: ShareImageKind
  /** Column title shown on the card */
  title: string
  /** Date / counts line under the title */
  meta: string
  /** Full draft from the textarea — header/meta/URL are stripped for the body */
  draftText: string
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean)
  const lines: string[] = []
  for (const para of paragraphs) {
    const words = para.split(/\s+/)
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
    lines.push('') // paragraph gap marker
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * Pull the narrative body out of a composed draft so the card chrome
 * (title / meta / site URL) is not duplicated in the image.
 */
export function extractShareImageBody(draftText: string): string {
  let t = draftText.trim()
  if (!t) return ''

  if (t.endsWith(TBR_SITE_URL)) {
    t = t.slice(0, -TBR_SITE_URL.length).trimEnd()
  }

  const lines = t.split('\n')
  // Drop leading title line(s)
  while (lines.length) {
    const first = lines[0]!.trim()
    if (!first) {
      lines.shift()
      continue
    }
    if (
      /^Yesterday'?s\s+Build\b/i.test(first) ||
      /^[A-Za-z]{3}\s+\d{1,2}\s+Build\b/i.test(first) ||
      /^The\s+Needle\b/i.test(first)
    ) {
      lines.shift()
      continue
    }
    break
  }
  // Drop trailing meta like "12 repos · 40 commits" / "3 repos moved"
  while (lines.length) {
    const last = lines[lines.length - 1]!.trim()
    if (!last) {
      lines.pop()
      continue
    }
    if (/^\d+\s+repos?\b/i.test(last)) {
      lines.pop()
      continue
    }
    break
  }
  return lines.join('\n').trim()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function renderSharePostCanvas(input: ShareImageInput): HTMLCanvasElement {
  const body = extractShareImageBody(input.draftText) || input.draftText.trim()
  const contentWidth = WIDTH - PAD * 2

  // Measure with a probe canvas to pick font size / height
  const probe = document.createElement('canvas')
  const pctx = probe.getContext('2d')
  if (!pctx) throw new Error('Canvas not available')

  let fontSize = 32
  let lineHeight = Math.round(fontSize * 1.4)
  let wrapped: string[] = []

  const headerBlock = 96 + 28 + 36 + 20 // logo row + gap + title + meta-ish
  const footerBlock = 48
  const availableForBody = MAX_HEIGHT - PAD * 2 - headerBlock - footerBlock - 24

  for (let attempt = 0; attempt < 8; attempt++) {
    pctx.font = `400 ${fontSize}px Georgia, 'Times New Roman', serif`
    wrapped = wrapLines(pctx, body, contentWidth)
    const bodyLines = wrapped.filter(l => l !== '').length
    const gaps = wrapped.filter(l => l === '').length
    const bodyH = bodyLines * lineHeight + gaps * Math.round(lineHeight * 0.55)
    if (bodyH <= availableForBody || fontSize <= 22) break
    fontSize -= 2
    lineHeight = Math.round(fontSize * 1.4)
  }

  const bodyLines = wrapped.filter(l => l !== '').length
  const gaps = wrapped.filter(l => l === '').length
  const bodyH = bodyLines * lineHeight + gaps * Math.round(lineHeight * 0.55)
  const height = Math.min(
    MAX_HEIGHT,
    Math.max(MIN_HEIGHT, PAD * 2 + headerBlock + bodyH + footerBlock + 24),
  )

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, WIDTH, height)
  grad.addColorStop(0, BG_TOP)
  grad.addColorStop(1, BG_BOTTOM)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, WIDTH, height)

  let y = PAD

  // TBR mark
  const markSize = 72
  roundRect(ctx, PAD, y, markSize, markSize, 16)
  ctx.fillStyle = ACCENT
  ctx.fill()
  ctx.fillStyle = TEXT
  ctx.font = `700 28px ui-monospace, 'JetBrains Mono', Menlo, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TBR', PAD + markSize / 2, y + markSize / 2 + 1)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = ACCENT
  ctx.font = `600 18px system-ui, -apple-system, sans-serif`
  ctx.fillText('THE BUILD REPORT', PAD + markSize + 20, y + 32)
  ctx.fillStyle = MUTED
  ctx.font = `400 16px system-ui, -apple-system, sans-serif`
  ctx.fillText('Independent community project', PAD + markSize + 20, y + 56)

  y += markSize + 36

  // Column title
  ctx.fillStyle = TEXT
  ctx.font = `700 44px Georgia, 'Times New Roman', serif`
  ctx.fillText(input.title, PAD, y)
  y += 40

  if (input.meta) {
    ctx.fillStyle = MUTED
    ctx.font = `400 20px system-ui, -apple-system, sans-serif`
    ctx.fillText(input.meta, PAD, y)
    y += 36
  } else {
    y += 12
  }

  // Accent rule
  ctx.fillStyle = ACCENT
  ctx.fillRect(PAD, y, 64, 3)
  y += 28

  // Body
  ctx.fillStyle = BODY
  ctx.font = `400 ${fontSize}px Georgia, 'Times New Roman', serif`
  const gapH = Math.round(lineHeight * 0.55)
  for (const line of wrapped) {
    if (line === '') {
      y += gapH
      continue
    }
    ctx.fillText(line, PAD, y)
    y += lineHeight
  }

  // Footer
  ctx.fillStyle = MUTED
  ctx.font = `400 20px system-ui, -apple-system, sans-serif`
  ctx.fillText(FOOTER, PAD, height - PAD + 8)

  return canvas
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode PNG'))
    }, 'image/png')
  })
}

export function downloadPngBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyPngBlob(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

export function shareImageFilename(kind: ShareImageKind, dateKey: string): string {
  const base = kind === 'brief' ? 'yesterday-build' : 'the-needle'
  return `${base}-${dateKey || 'draft'}.png`
}
