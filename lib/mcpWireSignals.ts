/**
 * Concrete, non-scored reasons to surface an MCP Registry listing in Admin.
 * Strong identifier matching only — no fuzzy “sounds like Mastra” guesses.
 */
import {
  EXTERNAL_BRIEF_ACCOUNTS,
  externalBriefGithubUrl,
  type ExternalBriefAccount,
} from '@/lib/externalOwnerBrief'

export type WireWhyCode =
  | 'tracked'
  | 'newTool'
  | 'crypto'
  | 'realCode'
  | 'withdrawn'
  | 'majorChange'
  | 'consequential'
  | 'firstRelease'

export const WHY_SHOWN_LABEL: Record<WireWhyCode, string> = {
  tracked: 'TRACKED PROJECT MATCH',
  newTool: 'NEW MCP REGISTRATION',
  crypto: 'NEW CRYPTO / ONCHAIN TOOL',
  realCode: 'PUBLIC SOURCE REPOSITORY',
  withdrawn: 'REMOVED FROM REGISTRY',
  majorChange: 'MAJOR CAPABILITY CHANGE',
  consequential: 'CONSEQUENTIAL ACCESS',
  firstRelease: 'FIRST / MAJOR RELEASE',
}

export type TrackedProjectHit = {
  accountId: string
  label: string
  owner: string
  githubUrl: string
  /** Yesterday's Builds newspaper — the existing internal destination. */
  buildsHref: '/yesterdays-builds'
}

/** Generic GitHub orgs we watch only by exact repo, never by owner-wide match. */
const BROAD_OWNERS = new Set(['base', 'google', 'openai'])

const CRYPTO_RE =
  /\b(wallets?|blockchains?|on-?chain|smart\s*contracts?|defi|web3|solana|ethereum|bitcoin|evm|erc-?20|polygon|arbitrum)\b/i

const CONSEQUENTIAL_RE =
  /\b(browser\s*control|puppeteer|playwright|headless\s*browser|shell\s*access|command\s*execution|terminal\s*access|ssh\b|cloud\s*infrastructure|deployments?|kubernetes|wallets?|money\s*movement|payments?|smart\s*contracts?|hardware\s*control|account\s*management|send(?:s|ing)?\s+messages?)\b/i

const FIRST_RELEASE_RE = /^v?(0\.1\.0|1\.0(\.0)?)$/i

export type RegistryLifecycle = 'active' | 'deprecated' | 'deleted'

export function parseRegistryStatus(raw?: string): RegistryLifecycle | undefined {
  const s = raw?.trim().toLowerCase()
  if (s === 'active' || s === 'deprecated' || s === 'deleted') return s
  return undefined
}

export function registryStatusDisplay(status?: RegistryLifecycle): string {
  if (status === 'active') return 'ACTIVE IN REGISTRY'
  if (status === 'deprecated') return 'DEPRECATED IN REGISTRY'
  if (status === 'deleted') return 'REMOVED FROM REGISTRY'
  return ''
}

/** Preserve GitHub owner/repo casing from the URL for display. */
export function githubRepoDisplay(url?: string): string | null {
  if (!url) return null
  const m = url.trim().match(/github\.com[/:]([^/\s]+)\/([^/\s?#]+)/i)
  if (!m) return null
  const owner = m[1]
  const repo = m[2].replace(/\.git$/i, '')
  if (!owner || !repo) return null
  return `${owner}/${repo}`
}

export function registryReasonLine(message?: string): string {
  const t = message?.trim()
  return t ? t : 'No reason supplied.'
}

export function githubPublisherDisplay(url?: string): string | undefined {
  const slug = githubRepoDisplay(url)
  if (!slug) return undefined
  return slug.split('/')[0]
}

export function parseGithubOwnerRepo(url?: string): { owner: string; repo: string } | null {
  if (!url) return null
  const trimmed = url.trim()
  const https = trimmed.match(/github\.com[/:]([^/\s]+)\/([^/\s?#]+)/i)
  if (!https) return null
  const owner = https[1].toLowerCase()
  const repo = https[2].replace(/\.git$/i, '').toLowerCase()
  if (!owner || !repo || owner === 'orgs' || owner === 'settings') return null
  return { owner, repo }
}

function ownerAliases(account: ExternalBriefAccount): string[] {
  const owner = account.owner.toLowerCase()
  const aliases = new Set<string>([owner, owner.replace(/-/g, '')])
  return [...aliases]
}

function namespaceTokens(serverName: string): string[] {
  return serverName
    .toLowerCase()
    .split(/[./]/)
    .map(t => t.trim())
    .filter(Boolean)
}

function repoAllowed(account: ExternalBriefAccount, repo: string): boolean {
  if (!account.focusRepos?.length) return !BROAD_OWNERS.has(account.owner.toLowerCase())
  return account.focusRepos.some(r => r.toLowerCase() === repo)
}

/**
 * Match only on GitHub owner/repo, registry namespace owner, or exact title === label.
 * Does not search descriptions.
 */
export function matchTrackedProject(input: {
  name: string
  title?: string
  repoUrl?: string
}): TrackedProjectHit | null {
  const gh = parseGithubOwnerRepo(input.repoUrl)
  const title = input.title?.trim().toLowerCase() ?? ''
  const tokens = namespaceTokens(input.name)
  const nameRepo = tokens[tokens.length - 1] ?? ''

  for (const account of EXTERNAL_BRIEF_ACCOUNTS) {
    const aliases = ownerAliases(account)
    const labelLc = account.label.toLowerCase()
    const hit = (): TrackedProjectHit => ({
      accountId: account.id,
      label: account.label,
      owner: account.owner,
      githubUrl: externalBriefGithubUrl(account),
      buildsHref: '/yesterdays-builds',
    })

    if (gh && aliases.includes(gh.owner) && repoAllowed(account, gh.repo)) return hit()

    const nsOwner = tokens.find(t => aliases.includes(t))
    if (nsOwner && repoAllowed(account, nameRepo)) return hit()

    if (title && title === labelLc) {
      const ownerEvidence =
        (gh && aliases.includes(gh.owner)) || tokens.some(t => aliases.includes(t))
      if (ownerEvidence) return hit()
    }
  }

  return null
}

export function hasCryptoOnchainSignal(blob: string): boolean {
  return CRYPTO_RE.test(blob)
}

export function hasConsequentialAccessSignal(blob: string): boolean {
  return CONSEQUENTIAL_RE.test(blob)
}

export function isFirstOrMajorRelease(version: string, kind: 'new' | 'revised' | 'withdrawn' | 'unknown'): boolean {
  if (kind !== 'new') return false
  return FIRST_RELEASE_RE.test(version.trim())
}

export function hasPublicSourceRepo(repoUrl?: string): boolean {
  return !!parseGithubOwnerRepo(repoUrl)
}

/** True only when two descriptions clearly differ — not a typo-sized tweak. */
export function isMaterialCapabilityChange(oldest: string, newest: string): boolean {
  const a = oldest.trim().replace(/\s+/g, ' ').toLowerCase()
  const b = newest.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!a || !b || a === b) return false
  if (Math.abs(a.length - b.length) >= 40) return true
  return (
    (hasCryptoOnchainSignal(b) && !hasCryptoOnchainSignal(a)) ||
    (hasConsequentialAccessSignal(b) && !hasConsequentialAccessSignal(a))
  )
}

export function firstSentence(description: string): string {
  const t = description.trim().replace(/\s+/g, ' ')
  if (!t) return 'A connector listed in the public MCP Registry.'
  const cut = t.match(/^(.+?[.!?])(\s|$)/)
  const sentence = (cut ? cut[1] : t).slice(0, 220)
  return sentence
}

export function happenedLine(
  kind: 'new' | 'revised' | 'withdrawn' | 'unknown',
  status?: RegistryLifecycle,
): string {
  if (status === 'deleted') {
    return 'The official MCP Registry now marks this listing as deleted, so it is hidden from normal Registry listings.'
  }
  if (status === 'deprecated') {
    return 'The official MCP Registry now marks this listing as deprecated.'
  }
  if (kind === 'new') {
    return 'This listing first appeared in the official MCP Registry during this collection window.'
  }
  if (kind === 'withdrawn') {
    return 'The official MCP Registry marked this listing deleted or deprecated.'
  }
  if (kind === 'revised') {
    return 'Existing listing was updated in the official MCP Registry during this collection window.'
  }
  return 'Registry row with incomplete metadata.'
}

export function composeWhyShownText(args: {
  why: WireWhyCode[]
  tracked?: TrackedProjectHit | null
  kind: 'new' | 'revised' | 'withdrawn' | 'unknown'
  registryStatus?: RegistryLifecycle
}): string {
  if (args.kind === 'withdrawn' || args.why.includes('withdrawn')) {
    if (args.registryStatus === 'deprecated') {
      return 'Registry deprecations are surfaced automatically because a listing changed lifecycle status.'
    }
    return 'Registry removals are surfaced automatically because a previously listed MCP changed lifecycle status.'
  }

  const bits: string[] = []
  if (args.why.includes('tracked') && args.tracked) {
    bits.push(`${args.tracked.label} is already tracked by The Daily Loop`)
  }
  if (args.why.includes('newTool') || args.kind === 'new') bits.push('New registration')
  if (args.why.includes('crypto')) bits.push('crypto/onchain capability')
  if (args.why.includes('consequential')) bits.push('consequential access')
  if (args.why.includes('majorChange')) {
    bits.push('capability text changed this window')
  }
  if (args.why.includes('firstRelease')) bits.push('first or 1.0 version')
  if (args.why.includes('realCode')) bits.push('public source repository')
  if (bits.length === 0) return 'No low-interest filter matched.'
  const unique = [...new Set(bits)]
  const text = unique.join(' · ')
  return text.endsWith('.') ? text : `${text}.`
}

/**
 * Labels that explain a SHOW ME card. REAL CODE and NEW TOOL are labels, not
 * enough on their own to beat the firehose.
 */
export function surfaceWhy(input: {
  kind: 'new' | 'revised' | 'withdrawn' | 'unknown'
  name: string
  title?: string
  description: string
  version: string
  repoUrl?: string
  oldestDescription?: string
}): { why: WireWhyCode[]; tracked: TrackedProjectHit | null; surface: boolean } {
  const blob = `${input.name} ${input.title ?? ''} ${input.description}`
  const tracked = matchTrackedProject(input)
  const why: WireWhyCode[] = []

  if (tracked) why.push('tracked')
  if (input.kind === 'withdrawn') why.push('withdrawn')
  if (input.kind === 'new') why.push('newTool')
  if (input.kind === 'new' && hasCryptoOnchainSignal(blob)) why.push('crypto')
  if (hasPublicSourceRepo(input.repoUrl)) why.push('realCode')
  if (
    input.oldestDescription &&
    isMaterialCapabilityChange(input.oldestDescription, input.description)
  ) {
    why.push('majorChange')
  }
  const consequential =
    hasConsequentialAccessSignal(blob) &&
    (input.kind === 'new' || why.includes('majorChange') || !!tracked)
  if (consequential) why.push('consequential')
  if (
    isFirstOrMajorRelease(input.version, input.kind) &&
    (why.includes('tracked') ||
      why.includes('crypto') ||
      why.includes('consequential') ||
      why.includes('withdrawn') ||
      why.includes('majorChange'))
  ) {
    why.push('firstRelease')
  }

  const surface =
    why.includes('tracked') ||
    why.includes('withdrawn') ||
    why.includes('crypto') ||
    why.includes('consequential') ||
    why.includes('majorChange')

  return { why: surface ? why : why.filter(w => w !== 'newTool' && w !== 'realCode'), tracked, surface }
}
