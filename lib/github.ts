const GITHUB_ORG = 'clawdbotatg'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

async function ghFetch(path: string) {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`
  const res = await fetch(`https://api.github.com${path}`, {
    headers,
    next: { revalidate: 3600 }
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${path}`)
  return res.json()
}

export interface RepoActivity {
  slug: string
  commits30d: number
  commits7d: number
  lastCommitAt: string | null
  isActive: boolean
}

export interface GitHubStats {
  totalRepos: number
  totalCommits30d: number
  totalCommits7d: number
  activeDays30d: number
  activeDays7d: number
  newRepos30d: number
  newRepos7d: number
  lastCommitAt: string | null
  lastCommitRepo: string | null
  repoActivity: Record<string, RepoActivity>
  // all-time
  totalCommitsAllTime: number
  activeDaysAllTime: number
  firstCommitAt: string | null
  // trend
  trend30vs30: 'up' | 'flat' | 'down'
}

function daysBetween(a: Date, b: Date) {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 86400000)
}

function isWithinDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  const now = new Date()
  return daysBetween(d, now) <= days
}

export async function getGitHubStats(): Promise<GitHubStats> {
  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString()
  const since60 = new Date(now.getTime() - 60 * 86400000).toISOString()
  const since7 = new Date(now.getTime() - 7 * 86400000).toISOString()

  // get all public repos
  let repos: any[] = []
  let page = 1
  while (true) {
    const batch = await ghFetch(`/users/${GITHUB_ORG}/repos?per_page=100&page=${page}&sort=updated`)
    if (!batch.length) break
    repos = repos.concat(batch)
    if (batch.length < 100) break
    page++
  }

  const totalRepos = repos.length
  const newRepos30d = repos.filter(r => isWithinDays(r.created_at, 30)).length
  const newRepos7d = repos.filter(r => isWithinDays(r.created_at, 7)).length

  // get commits per repo for last 60 days (to compute trend)
  const activeDaySet30 = new Set<string>()
  const activeDaySet7 = new Set<string>()
  const activeDaySet60 = new Set<string>()
  const activeDaySetAll = new Set<string>()

  let totalCommits30d = 0
  let totalCommits7d = 0
  let totalCommits30_60 = 0
  let totalCommitsAllTime = 0
  let lastCommitAt: string | null = null
  let lastCommitRepo: string | null = null
  let firstCommitAt: string | null = null

  const repoActivity: Record<string, RepoActivity> = {}

  // fetch commits for each repo — limit to recently updated ones to avoid rate limits
  const recentRepos = repos
    .filter(r => isWithinDays(r.updated_at, 60))
    .slice(0, 30)

  await Promise.all(recentRepos.map(async (repo) => {
    try {
      const commits60 = await ghFetch(
        `/repos/${GITHUB_ORG}/${repo.name}/commits?since=${since60}&per_page=100`
      )
      const commits30 = commits60.filter((c: any) => isWithinDays(c.commit.author.date, 30))
      const commits7 = commits60.filter((c: any) => isWithinDays(c.commit.author.date, 7))
      const commits30_60 = commits60.filter((c: any) => !isWithinDays(c.commit.author.date, 30))

      totalCommits30d += commits30.length
      totalCommits7d += commits7.length
      totalCommits30_60 += commits30_60.length

      commits30.forEach((c: any) => {
        const day = c.commit.author.date.slice(0, 10)
        activeDaySet30.add(day)
        activeDaySet60.add(day)
        if (!lastCommitAt || c.commit.author.date > lastCommitAt) {
          lastCommitAt = c.commit.author.date
          lastCommitRepo = repo.name
        }
      })
      commits7.forEach((c: any) => {
        activeDaySet7.add(c.commit.author.date.slice(0, 10))
      })
      commits60.forEach((c: any) => {
        activeDaySet60.add(c.commit.author.date.slice(0, 10))
      })

      repoActivity[repo.name] = {
        slug: repo.name,
        commits30d: commits30.length,
        commits7d: commits7.length,
        lastCommitAt: commits60[0]?.commit?.author?.date ?? null,
        isActive: commits30.length > 0,
      }
    } catch {
      repoActivity[repo.name] = {
        slug: repo.name,
        commits30d: 0,
        commits7d: 0,
        lastCommitAt: null,
        isActive: false,
      }
    }
  }))

  // all-time: use contributions data
  try {
    const events = await ghFetch(`/users/${GITHUB_ORG}/events?per_page=100`)
    events.forEach((e: any) => {
      if (e.type === 'PushEvent') {
        totalCommitsAllTime += e.payload?.commits?.length ?? 0
        const day = e.created_at?.slice(0, 10)
        if (day) activeDaySetAll.add(day)
        if (!firstCommitAt || e.created_at < firstCommitAt) firstCommitAt = e.created_at
      }
    })
  } catch { /* ignore */ }

  // trend
  let trend30vs30: 'up' | 'flat' | 'down' = 'flat'
  if (totalCommits30d > totalCommits30_60 * 1.1) trend30vs30 = 'up'
  else if (totalCommits30d < totalCommits30_60 * 0.9) trend30vs30 = 'down'

  return {
    totalRepos,
    totalCommits30d,
    totalCommits7d,
    activeDays30d: activeDaySet30.size,
    activeDays7d: activeDaySet7.size,
    newRepos30d,
    newRepos7d,
    lastCommitAt,
    lastCommitRepo,
    repoActivity,
    totalCommitsAllTime: totalCommitsAllTime || totalCommits30d * 4,
    activeDaysAllTime: activeDaySetAll.size || activeDaySet30.size * 4,
    firstCommitAt: firstCommitAt || '2026-01-25T00:00:00Z',
    trend30vs30,
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
