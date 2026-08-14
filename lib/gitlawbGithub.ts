/**
 * Lightweight GitHub fetch for the gitlawb account — Yesterday's Build only.
 * Kept separate from clawdbotatg's getGitHubStats pipeline.
 */

import {
  dateKeyMountain,
  mountainDateKeyBoundsMs,
  yesterdayMountainDateKey,
} from '@/lib/buildBrief'

export const GITLAWB_OWNER = 'gitlawb'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export type GitlawbRepoCommit = {
  message: string
  date: string
}

export type GitlawbDayActivity = {
  slug: string
  description: string | null
  commits: GitlawbRepoCommit[]
}

export type GitlawbDaySnapshot = {
  owner: string
  dateKey: string
  activity: GitlawbDayActivity[]
  repoCount: number
  commitCount: number
  rateLimited: boolean
  fetchedAt: string
}

async function ghFetch(path: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  const token = GITHUB_TOKEN?.trim()
  if (token) headers.Authorization = `Bearer ${token}`

  let res = await fetch(`https://api.github.com${path}`, {
    headers,
    cache: 'no-store',
  })

  if (res.status === 401 && token) {
    console.warn(`[gitlawb-github] 401 with GITHUB_TOKEN for ${path}; retrying without auth`)
    const { Authorization: _drop, ...anonHeaders } = headers
    res = await fetch(`https://api.github.com${path}`, {
      headers: anonHeaders,
      cache: 'no-store',
    })
  }

  if (res.status === 403 || res.status === 429) {
    throw new Error('rate_limited')
  }

  if (!res.ok) {
    throw new Error(`GitHub ${res.status} for ${path}`)
  }

  return res.json()
}

function firstLine(message: string): string {
  return message.split('\n')[0]?.trim() || 'Commit'
}

/**
 * List public non-fork repos for gitlawb that were pushed recently enough
 * to possibly have commits on the target Mountain day, then pull those commits.
 */
export async function fetchGitlawbDayActivity(
  mountainDateKey = yesterdayMountainDateKey(),
): Promise<GitlawbDaySnapshot> {
  const { startMs, endMs } = mountainDateKeyBoundsMs(mountainDateKey)
  // GitHub `since` is inclusive; pull a little early so Mountain midnight isn't missed.
  const sinceIso = new Date(startMs - 12 * 3600000).toISOString()

  let repos: any[] = []
  let page = 1
  let rateLimited = false

  try {
    while (true) {
      const batch = await ghFetch(
        `/users/${GITLAWB_OWNER}/repos?per_page=100&page=${page}&sort=pushed&type=owner`,
      )
      if (!Array.isArray(batch) || batch.length === 0) break
      repos = repos.concat(batch)
      if (batch.length < 100) break
      page++
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'rate_limited') {
      return {
        owner: GITLAWB_OWNER,
        dateKey: mountainDateKey,
        activity: [],
        repoCount: 0,
        commitCount: 0,
        rateLimited: true,
        fetchedAt: new Date().toISOString(),
      }
    }
    throw err
  }

  // Skip forks / archived / .github; keep repos pushed after our since window.
  const candidates = repos
    .filter(r => !r.fork && !r.archived && r.name !== '.github')
    .filter(r => {
      const pushed = r.pushed_at ? Date.parse(r.pushed_at) : 0
      return Number.isFinite(pushed) && pushed >= startMs - 12 * 3600000
    })
    .sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, 40)

  const activity: GitlawbDayActivity[] = []

  for (const repo of candidates) {
    try {
      const commits = await ghFetch(
        `/repos/${GITLAWB_OWNER}/${repo.name}/commits?since=${sinceIso}&per_page=100`,
      )
      if (!Array.isArray(commits)) continue

      const onDay = commits
        .map((c: any) => ({
          message: firstLine(String(c?.commit?.message ?? '')),
          date: String(c?.commit?.author?.date ?? ''),
        }))
        .filter(c => c.date && dateKeyMountain(new Date(c.date)) === mountainDateKey)
        .filter(c => {
          const t = Date.parse(c.date)
          return Number.isFinite(t) && t >= startMs && t < endMs
        })

      if (!onDay.length) continue
      activity.push({
        slug: String(repo.name),
        description: typeof repo.description === 'string' ? repo.description : null,
        commits: onDay,
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'rate_limited') {
        rateLimited = true
        break
      }
      console.warn('[gitlawb-github] commit fetch failed', repo.name, err)
    }
  }

  activity.sort((a, b) => b.commits.length - a.commits.length)
  const commitCount = activity.reduce((n, a) => n + a.commits.length, 0)

  return {
    owner: GITLAWB_OWNER,
    dateKey: mountainDateKey,
    activity,
    repoCount: activity.length,
    commitCount,
    rateLimited,
    fetchedAt: new Date().toISOString(),
  }
}
