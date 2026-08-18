import { yesterdayMountainDateKey } from '@/lib/buildBrief'
import type { ExternalBriefAccountId, ExternalBriefData } from '@/lib/externalOwnerBrief'

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Valid Mountain-calendar YYYY-MM-DD, or null if malformed / impossible. */
export function parseValidDateKey(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null
  const m = raw.trim().match(DATE_KEY_RE)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

export function shiftDateKey(dateKey: string, days: number): string {
  const parsed = parseValidDateKey(dateKey)
  if (!parsed) return dateKey
  const [y, m, d] = parsed.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function latestYbIssueDateKey(now = new Date()): string {
  return yesterdayMountainDateKey(now)
}

export function canonicalYbIssuePath(dateKey: string): string {
  return `/yesterdays-builds?date=${dateKey}`
}

export function ybIssueHref(dateKey: string): string {
  return canonicalYbIssuePath(dateKey)
}

export function formatIssueShort(dateKey: string): string {
  const parsed = parseValidDateKey(dateKey)
  if (!parsed) return dateKey
  const [, m, d] = parsed.split('-').map(Number)
  return `${SHORT_MONTHS[m - 1]} ${d}`
}

export function formatIssueLong(dateKey: string): string {
  const parsed = parseValidDateKey(dateKey)
  if (!parsed) return dateKey
  const [y, m, d] = parsed.split('-').map(Number)
  return `${LONG_MONTHS[m - 1]} ${d}, ${y}`
}

export type YbIssueNavDates = {
  dateKey: string
  latestDateKey: string
  prevDateKey: string
  nextDateKey: string | null
}

export function ybIssueNavDates(dateKey: string, latestDateKey: string): YbIssueNavDates {
  const prevDateKey = shiftDateKey(dateKey, -1)
  const candidateNext = shiftDateKey(dateKey, 1)
  const nextDateKey = candidateNext > latestDateKey ? null : candidateNext
  return { dateKey, latestDateKey, prevDateKey, nextDateKey }
}

export type ResolvedYbIssue =
  | { ok: true; dateKey: string; requested: boolean }
  | { ok: false; reason: 'invalid' | 'future'; requestedRaw: string }

export function resolveYbIssueDate(
  raw: string | string[] | undefined,
  latestDateKey: string,
): ResolvedYbIssue {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === undefined || value === '') {
    return { ok: true, dateKey: latestDateKey, requested: false }
  }
  const parsed = parseValidDateKey(value)
  if (!parsed) return { ok: false, reason: 'invalid', requestedRaw: String(value) }
  if (parsed > latestDateKey) return { ok: false, reason: 'future', requestedRaw: parsed }
  return { ok: true, dateKey: parsed, requested: true }
}

export function hasCachedYbEdition(
  briefs: Partial<Record<ExternalBriefAccountId, ExternalBriefData | null>>,
): boolean {
  return Object.values(briefs).some(brief => {
    if (!brief) return false
    return Boolean(brief.general?.trim() || brief.text?.trim())
  })
}
