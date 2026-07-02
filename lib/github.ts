import { REPOS } from './scores'
import { shouldSkipRepo } from './repoFilters'

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
    ...(options?.fresh ? { cache: 'no-store' as const } : { next: { revalidate: 3600 } }),
  })

  if (!res.ok) {
    if (res.status === 403 || res.status === 429) throw new Error('rate_limited')
    throw new Error(`GitHub API error: ${res.status} ${path}`)
  }

  return res.json()
}

export interface RepoActivity {
  slug: string
  commits30d: number
  commits7d: number
  commits7_14: number
  commits30_60: number
  lastCommitAt: string | null
  pushedAt: string
  isActive: boolean
}

export interface GitHubRepo {
  name: string
  description: string | null
  createdAt: string
  pushedAt: string
  language: string | null
}

export interface GitHubStats {
  totalRepos: number
  totalCommits30d: number
  totalCommits7d: number
  totalCommits7_14: number
  totalCommits30_60: number
  activeDays30d: number
  activeDays7d: number
  activeDays7_14: number
  activeDays30_60: number
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

function isCreatedInDayRange(dateStr: string, minExclusive: number, maxInclusive: number) {
  return isInDayRange(dateStr, minExclusive, maxInclusive)
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

function selectReposForActivityScan(repos: any[], maxCount = 40): any[] {
  const sorted = [...repos].sort(
    (a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime(),
  )

  const selected: any[] = []
  const seen = new Set<string>()

  // Always include the most recently pushed repos (captures local-question, etc.)
  for (const repo of sorted) {
    if (selected.length >= 15) break
    if (!isWithinDays(repo.pushed_at, 60)) continue
    selected.push(repo)
    seen.add(repo.name)
  }

  for (const repo of sorted) {
    if (selected.length >= maxCount) break
    if (seen.has(repo.name)) continue
    if (!PRIORITY_SLUGS.includes(repo.name)) continue
    selected.push(repo)
    seen.add(repo.name)
  }

  for (const repo of sorted) {
    if (selected.length >= maxCount) break
    if (seen.has(repo.name) || !isWithinDays(repo.pushed_at, 30)) continue
    selected.push(repo)
    seen.add(repo.name)
  }

  return selected
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
  const newRepos7_14 = repos.filter(r => isCreatedInDayRange(r.created_at, 7, 14)).length
  const newRepos30_60 = repos.filter(r => isCreatedInDayRange(r.created_at, 30, 60)).length

  const reposToScan = selectReposForActivityScan(repos)

  const activeDaySet30 = new Set<string>()
  const activeDaySet7 = new Set<string>()
  const activeDaySet7_14 = new Set<string>()
  const activeDaySet30_60 = new Set<string>()
  let totalCommits30d = 0
  let totalCommits7d = 0
  let totalCommits7_14 = 0
  let totalCommits30_60 = 0
  let lastCommitAt: string | null = null
  let lastCommitRepo: string | null = null
  let rateLimited = false

  const repoActivity: Record<string, RepoActivity> = {}

  for (const repo of reposToScan) {
    try {
      const commits = await ghFetch(`/repos/${GITHUB_ORG}/${repo.name}/commits?since=${since60}&per_page=100`, { fresh })

      const c30 = commits.filter((c: any) => isWithinDays(c.commit.author.date, 30))
      const c7 = commits.filter((c: any) => isWithinDays(c.commit.author.date, 7))
      const c7_14 = commits.filter((c: any) => isInDayRange(c.commit.author.date, 7, 14))
      const c30_60 = commits.filter((c: any) => isInDayRange(c.commit.author.date, 30, 60))

      totalCommits30d += c30.length
      totalCommits7d += c7.length
      totalCommits7_14 += c7_14.length
      totalCommits30_60 += c30_60.length

      c30.forEach((c: any) => {
        const day = c.commit.author.date.slice(0, 10)
        activeDaySet30.add(day)
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

      repoActivity[repo.name] = {
        slug: repo.name,
        commits30d: c30.length,
        commits7d: c7.length,
        commits7_14: c7_14.length,
        commits30_60: c30_60.length,
        lastCommitAt: commits[0]?.commit?.author?.date ?? null,
        pushedAt: repo.pushed_at,
        isActive: c30.length > 0,
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
    repoActivity[repo.name] = {
      slug: repo.name,
      commits30d: 0,
      commits7d: 0,
      commits7_14: 0,
      commits30_60: 0,
      lastCommitAt: null,
      pushedAt: repo.pushed_at,
      isActive: isWithinDays(repo.pushed_at, 30),
    }
  }

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

  const trackableRepos = sortedRepos.filter(r => !shouldSkipRepo(r.name))

  return {
    totalRepos,
    totalCommits30d,
    totalCommits7d,
    totalCommits7_14,
    totalCommits30_60,
    activeDays30d,
    activeDays7d,
    activeDays7_14,
    activeDays30_60,
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
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
