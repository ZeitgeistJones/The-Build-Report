/**
 * Lightweight GitHub day-activity fetch for secondary builder accounts.
 * Supports whole-owner scans (capped) or a focusRepos allowlist (single-repo feeds).
 */

import {
  dateKeyMountain,
  mountainDateKeyBoundsMs,
  yesterdayMountainDateKey,
} from '@/lib/buildBrief'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export type ExternalRepoCommit = {
  message: string
  date: string
}

export type ExternalDayActivity = {
  slug: string
  description: string | null
  commits: ExternalRepoCommit[]
}

export type ExternalDaySnapshot = {
  owner: string
  dateKey: string
  activity: ExternalDayActivity[]
  repoCount: number
  commitCount: number
  rateLimited: boolean
  fetchedAt: string
}

export type FetchExternalDayOptions = {
  /** If set, only fetch these repo names under `owner` (skip org-wide listing). */
  focusRepos?: string[]
  /** Max repos to scan when listing an owner (ignored when focusRepos is set). */
  maxRepos?: number
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
    console.warn(`[external-owner-github] 401 with GITHUB_TOKEN for ${path}; retrying without auth`)
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

type RepoCandidate = { name: string; description: string | null }

async function listOwnerCandidates(
  ownerEnc: string,
  startMs: number,
  maxRepos: number,
): Promise<RepoCandidate[]> {
  let repos: any[] = []
  let page = 1
  while (true) {
    const batch = await ghFetch(
      `/users/${ownerEnc}/repos?per_page=100&page=${page}&sort=pushed&type=owner`,
    )
    if (!Array.isArray(batch) || batch.length === 0) break
    repos = repos.concat(batch)
    if (batch.length < 100) break
    page++
  }

  return repos
    .filter(r => !r.fork && !r.archived && r.name !== '.github')
    .filter(r => {
      const pushed = r.pushed_at ? Date.parse(r.pushed_at) : 0
      return Number.isFinite(pushed) && pushed >= startMs - 12 * 3600000
    })
    .sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, maxRepos)
    .map(r => ({
      name: String(r.name),
      description: typeof r.description === 'string' ? r.description : null,
    }))
}

async function resolveFocusCandidates(
  ownerEnc: string,
  focusRepos: string[],
): Promise<RepoCandidate[]> {
  const out: RepoCandidate[] = []
  for (const name of focusRepos) {
    const slug = name.trim()
    if (!slug) continue
    try {
      const meta = await ghFetch(`/repos/${ownerEnc}/${encodeURIComponent(slug)}`)
      out.push({
        name: slug,
        description: typeof meta?.description === 'string' ? meta.description : null,
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'rate_limited') throw err
      // Still try commits even if meta fails
      out.push({ name: slug, description: null })
    }
  }
  return out
}

/**
 * Commits on a Mountain calendar day for an owner — either a focus-repo allowlist
 * or up to `maxRepos` recently pushed public non-fork repos.
 */
export async function fetchExternalOwnerDayActivity(
  owner: string,
  mountainDateKey = yesterdayMountainDateKey(),
  options?: FetchExternalDayOptions,
): Promise<ExternalDaySnapshot> {
  const ownerEnc = encodeURIComponent(owner)
  const { startMs, endMs } = mountainDateKeyBoundsMs(mountainDateKey)
  const sinceIso = new Date(startMs - 12 * 3600000).toISOString()
  const focusRepos = (options?.focusRepos ?? []).map(s => s.trim()).filter(Boolean)
  const maxRepos = options?.maxRepos ?? 40

  let candidates: RepoCandidate[] = []
  let rateLimited = false

  try {
    candidates = focusRepos.length
      ? await resolveFocusCandidates(ownerEnc, focusRepos)
      : await listOwnerCandidates(ownerEnc, startMs, maxRepos)
  } catch (err) {
    if (err instanceof Error && err.message === 'rate_limited') {
      return {
        owner,
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

  const activity: ExternalDayActivity[] = []

  for (const repo of candidates) {
    try {
      const commits = await ghFetch(
        `/repos/${ownerEnc}/${encodeURIComponent(repo.name)}/commits?since=${sinceIso}&per_page=100`,
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
        slug: repo.name,
        description: repo.description,
        commits: onDay,
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'rate_limited') {
        rateLimited = true
        break
      }
      console.warn('[external-owner-github] commit fetch failed', owner, repo.name, err)
    }
  }

  activity.sort((a, b) => b.commits.length - a.commits.length)
  const commitCount = activity.reduce((n, a) => n + a.commits.length, 0)

  return {
    owner,
    dateKey: mountainDateKey,
    activity,
    repoCount: activity.length,
    commitCount,
    rateLimited,
    fetchedAt: new Date().toISOString(),
  }
}
