/**
 * Public Yesterday's Builds Wire — presentation + deterministic print selection.
 * Does not change collection, filters, or Admin SHOW ME rules.
 */
import type { WireInboxRow, WireItem } from '@/lib/mcpWire'
import {
  firstSentence,
  parseGithubOwnerRepo,
  type WireWhyCode,
} from '@/lib/mcpWireSignals'

export const PUBLIC_WIRE_CAP = 2

export type PublicWireStatus = 'NEW' | 'UPDATED' | 'DEPRECATED' | 'REMOVED FROM REGISTRY'
export type PublicWireBeat = 'ONCHAIN' | 'BROWSER' | 'AGENT INFRA' | 'DATA' | 'DEVELOPER TOOL'

export type PublicWireDispatch = {
  name: string
  title: string
  version: string
  status: PublicWireStatus
  beat?: PublicWireBeat
  time: string
  sentence: string
  deletionNote: boolean
  trackedNote: boolean
  repoUrl?: string
  stars?: number
}

const STRONG_PUBLIC_REASONS: WireWhyCode[] = [
  'tracked',
  'withdrawn',
  'crypto',
  'consequential',
  'majorChange',
]

export function isPublicWireWorthy(row: WireInboxRow): boolean {
  if (row.pile !== 'show') return false
  const why = row.whyShown ?? []
  return STRONG_PUBLIC_REASONS.some(code => why.includes(code))
}

/** Lower number prints first. Factual event class, not an interest score. */
export function publicWireClassRank(row: WireInboxRow): number {
  const why = row.whyShown ?? []
  if (why.includes('tracked')) return 1
  if (why.includes('withdrawn')) return 2
  if (why.includes('crypto')) return 3
  if (why.includes('consequential')) return 4
  if (why.includes('majorChange')) return 5
  return 6
}

function comparePublicRows(a: WireInboxRow, b: WireInboxRow): number {
  const classDiff = publicWireClassRank(a) - publicWireClassRank(b)
  if (classDiff !== 0) return classDiff
  const repoA = parseGithubOwnerRepo(a.repoUrl) ? 1 : 0
  const repoB = parseGithubOwnerRepo(b.repoUrl) ? 1 : 0
  if (repoB !== repoA) return repoB - repoA
  const starsDiff = (b.stars ?? -1) - (a.stars ?? -1)
  if (starsDiff !== 0) return starsDiff
  const timeDiff = (b.at || '').localeCompare(a.at || '')
  if (timeDiff !== 0) return timeDiff
  return a.name.localeCompare(b.name)
}

function sameExactRepo(a: WireInboxRow, b: WireInboxRow): boolean {
  const ga = parseGithubOwnerRepo(a.repoUrl)
  const gb = parseGithubOwnerRepo(b.repoUrl)
  if (!ga || !gb) return false
  return ga.owner === gb.owner && ga.repo === gb.repo
}

/**
 * Keep one public representative when two SHOW ME rows share the same repo
 * and the same event class. A lifecycle change and a new listing can both print.
 */
export function collapseRelatedPublicRows(rows: WireInboxRow[]): WireInboxRow[] {
  const ordered = [...rows].sort(comparePublicRows)
  const kept: WireInboxRow[] = []
  for (const row of ordered) {
    const dup = kept.find(existing => {
      if (!sameExactRepo(existing, row)) return false
      const aLife = existing.kind === 'withdrawn'
      const bLife = row.kind === 'withdrawn'
      return aLife === bLife
    })
    if (dup) continue
    kept.push(row)
  }
  return kept
}

export function inboxRowToWireItem(row: WireInboxRow): WireItem {
  return {
    name: row.name,
    title: row.title,
    description: row.description,
    version: row.version,
    kind: row.kind === 'unknown' ? 'revised' : row.kind,
    note: row.statusMessage,
    repoUrl: row.repoUrl,
    at: row.at,
    registryStatus: row.registryStatus,
    whyShown: row.whyShown,
    trackedLabel: row.tracked?.label,
    stars: row.stars,
  }
}

export function selectPublicWireItems(showRows: WireInboxRow[]): WireItem[] {
  const worthy = showRows.filter(isPublicWireWorthy)
  const collapsed = collapseRelatedPublicRows(worthy)

  // Live paper: the 2 SHOW ME listings with the most GitHub stars (need a linked repo).
  const starred = collapsed
    .filter(r => parseGithubOwnerRepo(r.repoUrl) && typeof r.stars === 'number')
    .sort(
      (a, b) =>
        (b.stars ?? 0) - (a.stars ?? 0) ||
        (b.at || '').localeCompare(a.at || '') ||
        a.name.localeCompare(b.name),
    )
  if (starred.length > 0) {
    return starred.slice(0, PUBLIC_WIRE_CAP).map(inboxRowToWireItem)
  }

  // Fallback before star backfill / when nothing has a public repo.
  return collapsed.sort(comparePublicRows).slice(0, PUBLIC_WIRE_CAP).map(inboxRowToWireItem)
}

export function publicWireStamp(at: string): string {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} UTC`
}

export function publicWireStatus(item: WireItem): PublicWireStatus {
  const status = item.registryStatus
  if (status === 'deleted') return 'REMOVED FROM REGISTRY'
  if (status === 'deprecated') return 'DEPRECATED'
  if (item.kind === 'withdrawn') return 'REMOVED FROM REGISTRY'
  if (item.kind === 'new') return 'NEW'
  return 'UPDATED'
}

export function publicWireBeat(item: WireItem): PublicWireBeat | undefined {
  const why = item.whyShown ?? []
  if (why.includes('crypto')) return 'ONCHAIN'
  const blob = `${item.name} ${item.title ?? ''} ${item.description}`
  if (/\b(browser|puppeteer|playwright|headless)\b/i.test(blob)) return 'BROWSER'
  if (/\b(databases?|postgres|dataset)\b/i.test(blob) && !why.includes('withdrawn')) {
    return 'DATA'
  }
  if (why.includes('consequential')) return 'AGENT INFRA'
  return undefined
}

export function publisherClaimNeedsAttribution(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/\d/.test(t) && /\b(verified|users?|customers?|entities|downloads?|installs?)\b/i.test(t)) {
    return true
  }
  return /\d[\d,.]*\s*(m|k|million|billion)\b/i.test(t)
}

export function publicWireSentence(item: WireItem): string {
  const status = publicWireStatus(item)
  if (status === 'REMOVED FROM REGISTRY') {
    return 'The official MCP Registry now marks this listing as deleted.'
  }
  if (status === 'DEPRECATED') {
    return 'The official MCP Registry now marks this listing as deprecated.'
  }
  const raw = firstSentence(item.description)
  if (publisherClaimNeedsAttribution(raw)) {
    const clipped = raw.replace(/\.$/, '')
    return `The Registry listing describes it as: ${clipped}.`
  }
  return raw
}

export function toPublicWireDispatch(item: WireItem): PublicWireDispatch {
  const title = item.title?.trim() || item.name
  const status = publicWireStatus(item)
  const beat = publicWireBeat(item)
  return {
    name: item.name,
    title,
    version: item.version,
    status,
    beat: status === 'REMOVED FROM REGISTRY' || status === 'DEPRECATED' ? undefined : beat,
    time: publicWireStamp(item.at),
    sentence: publicWireSentence(item),
    deletionNote: status === 'REMOVED FROM REGISTRY',
    trackedNote: Boolean(item.trackedLabel),
    repoUrl: item.repoUrl,
    stars: item.stars,
  }
}
