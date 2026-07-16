import { REPOS } from './scores'
import { shouldSkipRepo } from './repoFilters'
import { getTrackableForceIncludeSet } from './repoCollections'
import { setLastGithubScanAt } from './githubScan'
import { COMMIT_CAP } from './commitsSinceScore'

const GITHUB_ORG = 'clawdbotatg'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const PRIORITY_SLUGS = Array.from(new Set(REPOS.map(r => r.githubSlug)))

async function ghFetch(path: string, options?: { fresh?: boolean }) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`

  const res = await fetch(`https://api.github.com${path}`, {
    headers,
    ...(options?.fresh
      ? { cache: 'no-store' as const }
      : { next: { revalidate: 3600, tags: ['github-stats'] } }),
  })

  if (!res.ok) {
    if (res.status === 403 || res.status === 429) throw new Error('rate_limited')
    throw new Error(`GitHub API error: ${res.status} ${path}`)
  }

  return res.json()
}

export interface RecentCommit {
  date: string
  message: string
}

export interface RepoActivity {
  slug: string
  commits24h?: number
  commits24_48?: number
  commits30d?: number
  commits7d?: number
  commits7_14?: number
  commits30_60?: number
  /** ISO timestamps from the 60d commit scan (newest first, capped at 100). */
  commitTimestamps: string[]
  /** Newest first, capped at 20 per repo — used for build brief. */
  recentCommits: RecentCommit[]
  lastCommitAt: string | null
  pushedAt: string
  isActive: boolean
  /** False for stub entries that were never fetched from the commits API. */
  commitsScanned?: boolean
  /** True when the GitHub commits fetch returned the per-repo cap (100). */
  commitsCapped?: boolean
}

export interface GitHubRepo {
  name: string
  description: string | null
  createdAt: string
  pushedAt: string
  language: string | null
  archived?: boolean
}

export interface GitHubStats {
  totalRepos: number
  totalCommits24h: number
  totalCommits24_48: number
  totalCommits30d: number
  totalCommits7d: number
  totalCommits7_14: number
  totalCommits30_60: number
  activeDays24h: number
  activeDays24_48: number
  activeDays30d: number
  activeDays7d: number
  activeDays7_14: number
  activeDays30_60: number
  newRepos24h: number
  newRepos24_48: number
  newRepos30d: number
  newRepos7d: number
  newRepos7_14: number
  newRepos30_60: number
  lastCommitAt: string | null
  lastCommitRepo: string | null
  repoActivity: Record<string, RepoActivity>
  repos: GitHubRepo[]
  /** GitHub repos eligible for listing/autoscore (noise repos excluded). */
  trackableRepos: GitHubRepo[]
  rateLimited: boolean
}

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return (now.getTime() - d.getTime()) / 86400000
}

function isWithinDays(dateStr: string, days: number) {
  return daysAgo(dateStr) <= days
}

function isInDayRange(dateStr: string, minExclusive: number, maxInclusive: number) {
  const days = daysAgo(dateStr)
  return days > minExclusive && days <= maxInclusive
}

function hoursAgo(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 3600000
}

function isWithinHours(dateStr: string, hours: number) {
  return hoursAgo(dateStr) <= hours
}

/** Count commit timestamps in a rolling hour window (for snapshot backfill). */
export function countCommitsWithinHours(
  timestamps: string[] | null | undefined,
  hours: number,
): number {
  if (!timestamps?.length) return 0
  return timestamps.filter(ts => isWithinHours(ts, hours)).length
}

function countCommitsInHourRange(
  timestamps: string[] | null | undefined,
  minExclusive: number,
  maxInclusive: number,
): number {
  if (!timestamps?.length) return 0
  return timestamps.filter(ts => isInHourRange(ts, minExclusive, maxInclusive)).length
}

function countCommitsWithinDays(
  timestamps: string[] | null | undefined,
  days: number,
): number {
  if (!timestamps?.length) return 0
  return timestamps.filter(ts => isWithinDays(ts, days)).length
}

function countCommitsInDayRange(
  timestamps: string[] | null | undefined,
  minExclusive: number,
  maxInclusive: number,
): number {
  if (!timestamps?.length) return 0
  return timestamps.filter(ts => isInDayRange(ts, minExclusive, maxInclusive)).length
}

/** True when commit data came from a real GitHub commits fetch (not a listing stub). */
export function inferCommitsScanned(activity: RepoActivity): boolean {
  if (activity.commitsScanned === true) return true
  if (activity.commitsScanned === false) return false
  return (activity.commitTimestamps?.length ?? 0) > 0 || activity.lastCommitAt != null
}

/** Backfill rolling windows from commitTimestamps on every read — stored counts go stale. */
export function enrichRepoActivityFromTimestamps(activity: RepoActivity): RepoActivity {
  const ts = activity.commitTimestamps
  if (ts?.length) {
    return {
      ...activity,
      commitsScanned: true,
      commits24h: countCommitsWithinHours(ts, 24),
      commits24_48: countCommitsInHourRange(ts, 24, 48),
      commits7d: countCommitsWithinDays(ts, 7),
      commits7_14: countCommitsInDayRange(ts, 7, 14),
      commits30d: countCommitsWithinDays(ts, 30),
      commits30_60: countCommitsInDayRange(ts, 30, 60),
    }
  }
  if (!inferCommitsScanned(activity)) {
    const { commits24h: _a, commits24_48: _b, ...rest } = activity
    return { ...rest, commitsScanned: false }
  }
  return activity
}

/** Recent push with no scanned commit data — snapshot self-heal should refresh. */
export function repoActivityNeedsRescan(
  activity: RepoActivity | undefined,
  pushedAt: string,
): boolean {
  if (!isWithinDays(pushedAt, 7)) return false
  if (!activity) return true
  if (inferCommitsScanned(activity)) return false
  return (activity.commitTimestamps?.length ?? 0) === 0
}

export function githubStatsNeedsActivityRescan(stats: GitHubStats): boolean {
  const repos = stats.trackableRepos?.length ? stats.trackableRepos : stats.repos
  for (const repo of repos) {
    if (repoActivityNeedsRescan(stats.repoActivity[repo.name], repo.pushedAt)) return true
  }
  return Object.values(stats.repoActivity).some(
    a => (a.commitTimestamps?.length ?? 0) > 0 && typeof a.commits24h !== 'number',
  )
}

/** Rebuild ecosystem totals from per-repo activity (noise repos excluded). */
export function recomputeGitHubStatsAggregates(stats: GitHubStats): GitHubStats {
  const activeDaySet24 = new Set<string>()
  const activeDaySet24_48 = new Set<string>()
  const activeDaySet7 = new Set<string>()
  const activeDaySet7_14 = new Set<string>()
  const activeDaySet30 = new Set<string>()
  const activeDaySet30_60 = new Set<string>()
  let totalCommits24h = 0
  let totalCommits24_48 = 0
  let totalCommits7d = 0
  let totalCommits7_14 = 0
  let totalCommits30d = 0
  let totalCommits30_60 = 0

  for (const [slug, activity] of Object.entries(stats.repoActivity ?? {})) {
    // Ecosystem aggregates always ignore noise — force-include is listing-only.
    if (shouldSkipRepo(slug)) continue
    const a = enrichRepoActivityFromTimestamps(activity)
    totalCommits24h += a.commits24h ?? 0
    totalCommits24_48 += a.commits24_48 ?? 0
    totalCommits7d += a.commits7d ?? 0
    totalCommits7_14 += a.commits7_14 ?? 0
    totalCommits30d += a.commits30d ?? 0
    totalCommits30_60 += a.commits30_60 ?? 0

    for (const ts of a.commitTimestamps ?? []) {
      if (isWithinHours(ts, 24)) activeDaySet24.add(ts.slice(0, 10))
      else if (isInHourRange(ts, 24, 48)) activeDaySet24_48.add(ts.slice(0, 10))
      if (isWithinDays(ts, 7)) activeDaySet7.add(ts.slice(0, 10))
      else if (isInDayRange(ts, 7, 14)) activeDaySet7_14.add(ts.slice(0, 10))
      if (isWithinDays(ts, 30)) activeDaySet30.add(ts.slice(0, 10))
      else if (isInDayRange(ts, 30, 60)) activeDaySet30_60.add(ts.slice(0, 10))
    }
  }

  const filteredLast = getTrackableLastCommit(stats)
  return {
    ...stats,
    totalCommits24h,
    totalCommits24_48,
    totalCommits7d,
    totalCommits7_14,
    totalCommits30d,
    totalCommits30_60,
    activeDays24h: capActiveDays(activeDaySet24.size, 1),
    activeDays24_48: capActiveDays(activeDaySet24_48.size, 1),
    activeDays7d: capActiveDays(activeDaySet7.size, 7),
    activeDays7_14: capActiveDays(activeDaySet7_14.size, 7),
    activeDays30d: capActiveDays(activeDaySet30.size, 30),
    activeDays30_60: capActiveDays(activeDaySet30_60.size, 30),
    lastCommitAt: filteredLast.lastCommitAt,
    lastCommitRepo: filteredLast.lastCommitRepo,
  }
}

/**
 * Fold a rate-limited / thin scan into the last good snapshot so newest scanned
 * repos (and the fresh repo list) still land instead of being discarded entirely.
 */
export function mergePartialGitHubStats(
  existing: GitHubStats,
  incoming: GitHubStats,
): GitHubStats {
  const repoActivity: Record<string, RepoActivity> = { ...existing.repoActivity }
  let mergedScans = 0
  for (const [slug, activity] of Object.entries(incoming.repoActivity ?? {})) {
    if (activity.commitsScanned) {
      repoActivity[slug] = activity
      mergedScans++
    }
  }

  const existingTrackable = existing.trackableRepos?.length ?? 0
  const incomingTrackable = incoming.trackableRepos?.length ?? 0
  const useIncomingList =
    (incoming.repos?.length ?? 0) > 0 &&
    (existingTrackable === 0 || incomingTrackable >= existingTrackable * MIN_TRACKABLE_RETENTION_FOR_MERGE)

  const repos = useIncomingList ? incoming.repos : existing.repos
  const trackableRepos = useIncomingList
    ? incoming.trackableRepos
    : existing.trackableRepos

  for (const repo of repos) {
    const prev = repoActivity[repo.name]
    if (!prev) continue
    repoActivity[repo.name] = { ...prev, pushedAt: repo.pushedAt }
  }

  const merged: GitHubStats = {
    ...existing,
    totalRepos: incoming.totalRepos || existing.totalRepos,
    newRepos24h: useIncomingList ? incoming.newRepos24h : existing.newRepos24h,
    newRepos24_48: useIncomingList ? incoming.newRepos24_48 : existing.newRepos24_48,
    newRepos7d: useIncomingList ? incoming.newRepos7d : existing.newRepos7d,
    newRepos7_14: useIncomingList ? incoming.newRepos7_14 : existing.newRepos7_14,
    newRepos30d: useIncomingList ? incoming.newRepos30d : existing.newRepos30d,
    newRepos30_60: useIncomingList ? incoming.newRepos30_60 : existing.newRepos30_60,
    repos,
    trackableRepos,
    repoActivity,
    // Partial merges are display-ready; don't leave the homepage stuck on the banner.
    rateLimited: Boolean(incoming.rateLimited && mergedScans === 0),
  }

  return enrichGitHubStatsPeriodCounts(merged)
}

/** Keep merge threshold in sync with snapshot retention (avoid circular import). */
const MIN_TRACKABLE_RETENTION_FOR_MERGE = 0.8

export function enrichGitHubStatsPeriodCounts(stats: GitHubStats): GitHubStats {
  const repoActivity: Record<string, RepoActivity> = {}
  for (const [slug, activity] of Object.entries(stats.repoActivity)) {
    repoActivity[slug] = enrichRepoActivityFromTimestamps(activity)
  }
  return recomputeGitHubStatsAggregates({ ...stats, repoActivity })
}

function isInHourRange(dateStr: string, minExclusive: number, maxInclusive: number) {
  const h = hoursAgo(dateStr)
  return h > minExclusive && h <= maxInclusive
}

/** Whether a commit timestamp falls in the builder-activity window (current or prior). */
export function commitInActivityWindow(
  dateStr: string,
  period: '24h' | '7d' | '30d' | '60d',
  window: 'current' | 'prior',
): boolean {
  if (period === '24h') {
    return window === 'current' ? isWithinHours(dateStr, 24) : isInHourRange(dateStr, 24, 48)
  }
  if (period === '7d') {
    return window === 'current' ? isWithinDays(dateStr, 7) : isInDayRange(dateStr, 7, 14)
  }
  if (period === '30d') {
    return window === 'current' ? isWithinDays(dateStr, 30) : isInDayRange(dateStr, 30, 60)
  }
  return isWithinDays(dateStr, 60)
}

/** Whether a GitHub repo was created inside the selected activity window. */
export function isCreatedInPeriod(
  createdAt: string | null | undefined,
  period: '24h' | '7d' | '30d' | '60d',
): boolean {
  if (!createdAt) return false
  if (period === '24h') return isWithinHours(createdAt, 24)
  if (period === '7d') return isWithinDays(createdAt, 7)
  if (period === '30d') return isWithinDays(createdAt, 30)
  return isWithinDays(createdAt, 60)
}

/** True when an ISO/locale timestamp falls in the selected rolling window. */
export function isTimestampInPeriod(
  timestamp: string | null | undefined,
  period: '24h' | '7d' | '30d' | '60d',
): boolean {
  return isCreatedInPeriod(timestamp, period)
}

function isCreatedInDayRange(dateStr: string, minExclusive: number, maxInclusive: number) {
  return isInDayRange(dateStr, minExclusive, maxInclusive)
}

function isCreatedInHourRange(dateStr: string, minExclusive: number, maxInclusive: number) {
  return isInHourRange(dateStr, minExclusive, maxInclusive)
}

/** Rolling N-day window can span N+1 unique calendar dates; cap for display and grades. */
function capActiveDays(uniqueDayCount: number, periodDays: number): number {
  return Math.min(uniqueDayCount, periodDays)
}

// Slugs used only for scoring card activity lookups
export const SCORED_SLUGS = [
  'leftclaw-services',
  'clawd-incinerator',
  'clawd-fomo3d-v2',
  'clawd-pfp-market',
  '1024x',
  'clawdviction',
  'clawd-vesting',
  'liquidity-vesting',
  'clawd-meme-arena',
  'zkllmapi-v2',
  'clawd-talk-to-your-wallet',
  'ethskills',
  'dead-simple-agent',
  'clawd-containers',
  'clawd-token-hub',
  'sponsor-clawdbotatg-eth',
  'yet-another-builder-agent',
]

function selectReposForActivityScan(
  repos: any[],
  maxCount = 40,
  shouldInclude?: (name: string) => boolean,
): any[] {
  const sorted = [...repos].sort(
    (a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime(),
  )

  const selected: any[] = []
  const seen = new Set<string>()
  const include = (repo: any) => !shouldInclude || shouldInclude(repo.name)

  // Always include the most recently pushed repos (captures local-question, etc.)
  for (const repo of sorted) {
    if (selected.length >= 15) break
    if (!isWithinDays(repo.pushed_at, 60)) continue
    if (!include(repo)) continue
    selected.push(repo)
    seen.add(repo.name)
  }

  for (const repo of sorted) {
    if (selected.length >= maxCount) break
    if (seen.has(repo.name)) continue
    if (!PRIORITY_SLUGS.includes(repo.name)) continue
    if (!include(repo)) continue
    selected.push(repo)
    seen.add(repo.name)
  }

  for (const repo of sorted) {
    if (selected.length >= maxCount) break
    if (seen.has(repo.name) || !isWithinDays(repo.pushed_at, 30)) continue
    if (!include(repo)) continue
    selected.push(repo)
    seen.add(repo.name)
  }

  return selected
}

/** Latest commit among non-noise repos (ignores force-include overrides for job/cv repos). */
export function getTrackableLastCommit(stats: GitHubStats): {
  lastCommitAt: string | null
  lastCommitRepo: string | null
} {
  let lastCommitAt: string | null = null
  let lastCommitRepo: string | null = null
  for (const repo of stats.repos) {
    if (shouldSkipRepo(repo.name)) continue
    const at = stats.repoActivity[repo.name]?.lastCommitAt
    if (at && (!lastCommitAt || at > lastCommitAt)) {
      lastCommitAt = at
      lastCommitRepo = repo.name
    }
  }
  return { lastCommitAt, lastCommitRepo }
}

const RECENT_COMMITS_CAP = 20

function firstCommitLine(message: string): string {
  return message.split('\n')[0].trim()
}

function parseRecentCommits(commits: { commit: { author: { date: string }; message: string } }[]): RecentCommit[] {
  return commits
    .slice(0, RECENT_COMMITS_CAP)
    .map(c => ({
      date: c.commit.author.date,
      message: firstCommitLine(c.commit.message ?? ''),
    }))
    .filter(c => c.date && c.message)
}

function buildRepoActivityFromCommits(
  slug: string,
  commits: { commit: { author: { date: string }; message: string } }[],
  pushedAt: string,
): RepoActivity {
  const c24 = commits.filter(c => isWithinHours(c.commit.author.date, 24))
  const c24_48 = commits.filter(c => isInHourRange(c.commit.author.date, 24, 48))
  const c30 = commits.filter(c => isWithinDays(c.commit.author.date, 30))
  const c7 = commits.filter(c => isWithinDays(c.commit.author.date, 7))
  const c7_14 = commits.filter(c => isInDayRange(c.commit.author.date, 7, 14))
  const c30_60 = commits.filter(c => isInDayRange(c.commit.author.date, 30, 60))

  return {
    slug,
    commits24h: c24.length,
    commits24_48: c24_48.length,
    commits30d: c30.length,
    commits7d: c7.length,
    commits7_14: c7_14.length,
    commits30_60: c30_60.length,
    commitTimestamps: commits.map(c => c.commit.author.date),
    recentCommits: parseRecentCommits(commits),
    lastCommitAt: commits[0]?.commit?.author?.date ?? null,
    pushedAt,
    isActive: c30.length > 0,
    commitsScanned: true,
    commitsCapped: commits.length >= COMMIT_CAP,
  }
}

/**
 * Targeted commit scan for a small slug list (homepage catch-up).
 * Does not rebuild the full ecosystem stats — caller merges into the snapshot.
 */
export async function refreshReposCommitActivity(
  slugs: string[],
  options?: { fresh?: boolean; pushedAtBySlug?: Map<string, string> },
): Promise<{ repoActivity: Record<string, RepoActivity>; rateLimited: boolean }> {
  const since60 = new Date(Date.now() - 60 * 86400000).toISOString()
  const fresh = options?.fresh ?? true
  const repoActivity: Record<string, RepoActivity> = {}
  let rateLimited = false

  for (const slug of slugs) {
    if (!slug) continue
    try {
      const commits = await ghFetch(
        `/repos/${GITHUB_ORG}/${slug}/commits?since=${since60}&per_page=100`,
        { fresh },
      )
      if (!Array.isArray(commits)) continue
      const pushedAt =
        options?.pushedAtBySlug?.get(slug) ??
        commits[0]?.commit?.author?.date ??
        new Date().toISOString()
      repoActivity[slug] = buildRepoActivityFromCommits(slug, commits, pushedAt)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'rate_limited') {
        rateLimited = true
        break
      }
    }
  }

  return { repoActivity, rateLimited }
}

export async function getGitHubStats(options?: { fresh?: boolean }): Promise<GitHubStats> {
  const since60 = new Date(Date.now() - 60 * 86400000).toISOString()
  const fresh = options?.fresh ?? false

  let repos: any[] = []
  let page = 1

  while (true) {
    const batch = await ghFetch(`/users/${GITHUB_ORG}/repos?per_page=100&page=${page}&sort=pushed`, { fresh })
    if (!batch.length) break
    repos = repos.concat(batch)
    if (batch.length < 100) break
    page++
  }

  const totalRepos = repos.length
  const newRepos30d = repos.filter(r => isWithinDays(r.created_at, 30)).length
  const newRepos7d = repos.filter(r => isWithinDays(r.created_at, 7)).length
  const newRepos24h = repos.filter(r => isWithinHours(r.created_at, 24)).length
  const newRepos24_48 = repos.filter(r => isCreatedInHourRange(r.created_at, 24, 48)).length
  const newRepos7_14 = repos.filter(r => isCreatedInDayRange(r.created_at, 7, 14)).length
  const newRepos30_60 = repos.filter(r => isCreatedInDayRange(r.created_at, 30, 60)).length

  const forceInclude = await getTrackableForceIncludeSet()
  // Ecosystem aggregate stats always exclude noise repos — force-include is for listing only.
  const includeInActivityScan = (name: string) => !shouldSkipRepo(name)
  const reposToScan = selectReposForActivityScan(repos, 40, includeInActivityScan)

  // B1: also scan force-included repos (few, admin-tracked job/cv repos) so they get real
  // per-repo commit stats for the listing — without competing for the 40 ecosystem slots or
  // contributing to aggregate totals (guarded by includeInActivityScan below).
  if (forceInclude.size > 0) {
    const alreadyScanning = new Set(reposToScan.map(r => r.name))
    for (const repo of repos) {
      if (forceInclude.has(repo.name) && !alreadyScanning.has(repo.name)) {
        reposToScan.push(repo)
        alreadyScanning.add(repo.name)
      }
    }
  }

  // Per-repo listing needs real counts for recently pushed repos — not stub zeros.
  {
    const scanning = new Set(reposToScan.map(r => r.name))
    for (const repo of repos) {
      if (scanning.has(repo.name)) continue
      if (!isWithinDays(repo.pushed_at, 7)) continue
      if (shouldSkipRepo(repo.name, { forceInclude })) continue
      reposToScan.push(repo)
      scanning.add(repo.name)
    }
  }

  const activeDaySet24 = new Set<string>()
  const activeDaySet24_48 = new Set<string>()
  const activeDaySet30 = new Set<string>()
  const activeDaySet7 = new Set<string>()
  const activeDaySet7_14 = new Set<string>()
  const activeDaySet30_60 = new Set<string>()
  let totalCommits24h = 0
  let totalCommits24_48 = 0
  let totalCommits30d = 0
  let totalCommits7d = 0
  let totalCommits7_14 = 0
  let totalCommits30_60 = 0
  let lastCommitAt: string | null = null
  let lastCommitRepo: string | null = null
  let rateLimited = false

  const repoActivity: Record<string, RepoActivity> = {}

  // Rate limits stop the loop early — scan newest pushes first.
  reposToScan.sort(
    (a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime(),
  )

  for (const repo of reposToScan) {
    try {
      const commits = await ghFetch(`/repos/${GITHUB_ORG}/${repo.name}/commits?since=${since60}&per_page=100`, { fresh })

      const c24 = commits.filter((c: any) => isWithinHours(c.commit.author.date, 24))
      const c24_48 = commits.filter((c: any) => isInHourRange(c.commit.author.date, 24, 48))
      const c30 = commits.filter((c: any) => isWithinDays(c.commit.author.date, 30))
      const c7 = commits.filter((c: any) => isWithinDays(c.commit.author.date, 7))
      const c7_14 = commits.filter((c: any) => isInDayRange(c.commit.author.date, 7, 14))
      const c30_60 = commits.filter((c: any) => isInDayRange(c.commit.author.date, 30, 60))

      // Force-included noise repos get per-repo stats but are excluded from ecosystem aggregates.
      const countsTowardEcosystem = includeInActivityScan(repo.name)

      if (countsTowardEcosystem) {
        totalCommits24h += c24.length
        totalCommits24_48 += c24_48.length
        totalCommits30d += c30.length
        totalCommits7d += c7.length
        totalCommits7_14 += c7_14.length
        totalCommits30_60 += c30_60.length

        c24.forEach((c: any) => {
          activeDaySet24.add(c.commit.author.date.slice(0, 10))
        })

        c24_48.forEach((c: any) => {
          activeDaySet24_48.add(c.commit.author.date.slice(0, 10))
        })

        c30.forEach((c: any) => {
          activeDaySet30.add(c.commit.author.date.slice(0, 10))
          if (!lastCommitAt || c.commit.author.date > lastCommitAt) {
            lastCommitAt = c.commit.author.date
            lastCommitRepo = repo.name
          }
        })

        c7.forEach((c: any) => {
          activeDaySet7.add(c.commit.author.date.slice(0, 10))
        })

        c7_14.forEach((c: any) => {
          activeDaySet7_14.add(c.commit.author.date.slice(0, 10))
        })

        c30_60.forEach((c: any) => {
          activeDaySet30_60.add(c.commit.author.date.slice(0, 10))
        })
      }

      repoActivity[repo.name] = {
        slug: repo.name,
        commits24h: c24.length,
        commits24_48: c24_48.length,
        commits30d: c30.length,
        commits7d: c7.length,
        commits7_14: c7_14.length,
        commits30_60: c30_60.length,
        commitTimestamps: commits.map((c: { commit: { author: { date: string } } }) => c.commit.author.date),
        recentCommits: parseRecentCommits(commits),
        lastCommitAt: commits[0]?.commit?.author?.date ?? null,
        pushedAt: repo.pushed_at,
        isActive: c30.length > 0,
        commitsScanned: true,
        commitsCapped: commits.length >= COMMIT_CAP,
      }
    } catch (err: any) {
      if (err.message === 'rate_limited') {
        rateLimited = true
        break
      }
    }
  }

  for (const repo of repos) {
    if (repoActivity[repo.name]) continue
    if (!PRIORITY_SLUGS.includes(repo.name) && !isWithinDays(repo.pushed_at, 14)) continue
    // Recently pushed repos must be scanned — omit stub so UI shows unknown, not 0.
    if (isWithinDays(repo.pushed_at, 7)) continue
    repoActivity[repo.name] = {
      slug: repo.name,
      commits24h: 0,
      commits24_48: 0,
      commits30d: 0,
      commits7d: 0,
      commits7_14: 0,
      commits30_60: 0,
      commitTimestamps: [],
      recentCommits: [],
      lastCommitAt: null,
      pushedAt: repo.pushed_at,
      isActive: isWithinDays(repo.pushed_at, 30),
      commitsScanned: false,
    }
  }

  const activeDays24h = capActiveDays(activeDaySet24.size, 1)
  const activeDays24_48 = capActiveDays(activeDaySet24_48.size, 1)
  const rawActiveDays7 = activeDaySet7.size
  const rawActiveDays30 = activeDaySet30.size
  const activeDays7d = capActiveDays(rawActiveDays7, 7)
  const activeDays30d = capActiveDays(rawActiveDays30, 30)
  const activeDays7_14 = capActiveDays(activeDaySet7_14.size, 7)
  const activeDays30_60 = capActiveDays(activeDaySet30_60.size, 30)

  const sortedRepos = repos
    .map((r: any) => ({
      name: r.name,
      description: r.description ?? null,
      createdAt: r.created_at,
      pushedAt: r.pushed_at,
      language: r.language ?? null,
    }))
    .sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime())

  const trackableRepos = sortedRepos.filter(r => !shouldSkipRepo(r.name, { forceInclude }))

  if (!rateLimited) {
    await setLastGithubScanAt(new Date().toISOString()).catch(() => {})
  }

  const baseStats: GitHubStats = {
    totalRepos,
    totalCommits24h,
    totalCommits24_48,
    totalCommits30d,
    totalCommits7d,
    totalCommits7_14,
    totalCommits30_60,
    activeDays24h,
    activeDays24_48,
    activeDays30d,
    activeDays7d,
    activeDays7_14,
    activeDays30_60,
    newRepos24h,
    newRepos24_48,
    newRepos30d,
    newRepos7d,
    newRepos7_14,
    newRepos30_60,
    lastCommitAt,
    lastCommitRepo,
    repoActivity,
    repos: sortedRepos,
    trackableRepos,
    rateLimited,
  }

  const filteredLast = getTrackableLastCommit(baseStats)
  return {
    ...baseStats,
    lastCommitAt: filteredLast.lastCommitAt,
    lastCommitRepo: filteredLast.lastCommitRepo,
  }
}

export async function fetchRepoBySlug(
  slug: string,
  options?: { fresh?: boolean },
): Promise<GitHubRepo | null> {
  try {
    const data = await ghFetch(`/repos/${GITHUB_ORG}/${slug}`, { fresh: options?.fresh })
    return {
      name: data.name,
      description: data.description ?? null,
      createdAt: data.created_at,
      pushedAt: data.pushed_at,
      language: data.language ?? null,
      archived: data.archived === true,
    }
  } catch {
    return null
  }
}

export interface RepoEvidenceFlags {
  hasLicense: boolean
  hasSecurityMd: boolean
  hasTests: boolean
  hasLockfile: boolean
  hasCi: boolean
  hasChangelog: boolean
  hasContributing: boolean
}

export interface RepoEvidence {
  readmeExcerpt: string | null
  rootFiles: string[]
  flags: RepoEvidenceFlags
}

const README_MAX_CHARS = 2000

function deriveFlags(rootFiles: string[], hasCi: boolean): RepoEvidenceFlags {
  const names = rootFiles.map(f => f.toLowerCase())
  return {
    hasLicense: names.some(n => n === 'license' || n === 'license.md' || n === 'license.txt'),
    hasSecurityMd: names.some(n => n === 'security.md' || n === 'security.txt' || n === 'security'),
    hasTests: names.some(n => n === 'test' || n === 'tests' || n === '__tests__' || n === 'spec' || n === 'jest.config.js' || n === 'jest.config.ts' || n === 'vitest.config.ts'),
    hasLockfile: names.some(n => n === 'package-lock.json' || n === 'yarn.lock' || n === 'pnpm-lock.yaml' || n === 'poetry.lock' || n === 'cargo.lock'),
    hasCi,
    hasChangelog: names.some(n => n === 'changelog.md' || n === 'changelog' || n === 'changes.md' || n === 'history.md'),
    hasContributing: names.some(n => n === 'contributing.md' || n === 'contributing'),
  }
}

export async function fetchRepoEvidence(
  slug: string,
  options?: { fresh?: boolean },
): Promise<RepoEvidence | null> {
  try {
    const authHeaders: Record<string, string> = {}
    if (GITHUB_TOKEN) authHeaders['Authorization'] = `Bearer ${GITHUB_TOKEN}`

    const cacheOpts = options?.fresh
      ? { cache: 'no-store' as const }
      : { next: { revalidate: 3600, tags: ['github-stats'] as string[] } }

    const [readmeRes, contentsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${GITHUB_ORG}/${slug}/readme`, {
        headers: { ...authHeaders, Accept: 'application/vnd.github.raw+json' },
        ...cacheOpts,
      }),
      fetch(`https://api.github.com/repos/${GITHUB_ORG}/${slug}/contents/`, {
        headers: { ...authHeaders, Accept: 'application/vnd.github.v3+json' },
        ...cacheOpts,
      }),
    ])

    const readmeExcerpt = readmeRes.ok
      ? (await readmeRes.text()).slice(0, README_MAX_CHARS)
      : null

    const rootFiles: string[] = []
    if (contentsRes.ok) {
      const listing = await contentsRes.json()
      if (Array.isArray(listing)) {
        for (const entry of listing) {
          if (typeof entry?.name === 'string') rootFiles.push(entry.name)
        }
      }
    }

    const ciRes = await fetch(
      `https://api.github.com/repos/${GITHUB_ORG}/${slug}/contents/.github/workflows`,
      {
        headers: { ...authHeaders, Accept: 'application/vnd.github.v3+json' },
        ...cacheOpts,
      },
    )
    const hasCi = ciRes.ok && ciRes.status !== 404

    return { readmeExcerpt, rootFiles, flags: deriveFlags(rootFiles, hasCi) }
  } catch {
    return null
  }
}

export async function fetchCommits30dCount(slug: string): Promise<number> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const commits = await ghFetch(
      `/repos/${GITHUB_ORG}/${slug}/commits?since=${since}&per_page=100`,
      { fresh: true },
    )
    return Array.isArray(commits) ? commits.length : 0
  } catch {
    return 0
  }
}

export async function fetchRecentCommitMessages(slug: string, limit = 10): Promise<string[]> {
  try {
    const commits = await ghFetch(
      `/repos/${GITHUB_ORG}/${slug}/commits?per_page=${Math.min(limit, 100)}`,
      { fresh: true },
    )
    if (!Array.isArray(commits)) return []
    return commits
      .map((c: { commit?: { message?: string } }) => c.commit?.message?.split('\n')[0]?.trim())
      .filter((m): m is string => Boolean(m))
      .slice(0, limit)
  } catch {
    return []
  }
}

/** Lightweight live probe — repo list pushed_at only (no per-repo commit scan). */
export async function fetchTrackableRepoPushes(): Promise<Map<string, string>> {
  const forceInclude = await getTrackableForceIncludeSet()
  const map = new Map<string, string>()
  let page = 1

  while (true) {
    const batch = await ghFetch(
      `/users/${GITHUB_ORG}/repos?per_page=100&page=${page}&sort=pushed`,
      { fresh: true },
    )
    if (!Array.isArray(batch) || !batch.length) break
    for (const repo of batch) {
      if (!shouldSkipRepo(repo.name, { forceInclude })) {
        map.set(repo.name, repo.pushed_at)
      }
    }
    if (batch.length < 100) break
    page++
  }

  return map
}

/** Slugs whose live GitHub pushed_at moved after the snapshot was written. */
export function snapshotPushesBehindLive(
  stats: GitHubStats,
  livePushes: Map<string, string>,
): string[] {
  const behind: string[] = []
  for (const repo of stats.trackableRepos ?? []) {
    const live = livePushes.get(repo.name)
    if (!live) continue
    const snapshotMs = new Date(repo.pushedAt).getTime()
    const liveMs = new Date(live).getTime()
    if (Number.isNaN(snapshotMs) || Number.isNaN(liveMs)) continue
    if (liveMs > snapshotMs + 60_000) behind.push(repo.name)
  }
  return behind
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'unknown'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 60) return `${mins}m ago`
  if (hours < 48) return `${hours}h ago`
  return `${days}d ago`
}
