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
  trend30vs30: 'up' | 'flat' | 'down'
  rateLimited: boolean
}

function isWithinDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  const now = new Date()
  return (now.getTime() - d.getTime()) / 86400000 <= days
}

export async function getGitHubStats(): Promise<GitHubStats> {
  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString()
  const since60 = new Date(now.getTime() - 60 * 86400000).toISOString()
  const since7 = new Date(now.getTime() - 7 * 86400000).toISOString()

  // Step 1: get all public repos (paginated, ~3 requests for 274 repos)
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

  // Step 2: only fetch commits for our tracked repos (18 repos from scores.ts)
  // This is much more efficient than scanning all 274 repos
  const TRACKED_SLUGS = [
    'leftclaw-services', 'clawd-incinerator', 'clawd-fomo3d-v2',
    'clawd-pfp-market', '1024x', 'clawdviction', 'clawd-vesting',
    'liquidity-vesting', 'clawd-meme-arena', 'zkllmapi-v2',
    'clawd-talk-to-your-wallet', 'clawdviction', 'ethskills',
    'dead-simple-agent', 'clawd-containers', 'clawd-token-hub',
    'sponsor-clawdbotatg-eth', 'yet-another-builder-agent',
  ]

  const activeDaySet30 = new Set<string>()
  const activeDaySet7 = new Set<string>()
  let totalCommits30d = 0
  let totalCommits7d = 0
  let totalCommits30_60 = 0
  let lastCommitAt: string | null = null
  let lastCommitRepo: string | null = null
  let rateLimited = false

  const repoActivity: Record<string, RepoActivity> = {}

  // Sequential fetching to respect rate limits — 18 requests, well within 60/hr unauthenticated
  for (const slug of [...new Set(TRACKED_SLUGS)]) {
    try {
      const commits = await ghFetch(
        `/repos/${GITHUB_ORG}/${slug}/commits?since=${since60}&per_page=100`
      )

      const c30 = commits.filter((c: any) => isWithinDays(c.commit.author.date, 30))
      const c7 = commits.filter((c: any) => isWithinDays(c.commit.author.date, 7))
      const c30_60 = commits.filter((c: any) => !isWithinDays(c.commit.author.date, 30))

      totalCommits30d += c30.length
      totalCommits7d += c7.length
      totalCommits30_60 += c30_60.length

      c30.forEach((c: any) => {
        activeDaySet30.add(c.commit.author.date.slice(0, 10))
        if (!lastCommitAt || c.commit.author.date > lastCommitAt) {
          lastCommitAt = c.commit.author.date
          lastCommitRepo = slug
        }
      })
      c7.forEach((c: any) => activeDaySet7.add(c.commit.author.date.slice(0, 10)))

      repoActivity[slug] = {
        slug,
        commits30d: c30.length,
        commits7d: c7.length,
        lastCommitAt: commits[0]?.commit?.author?.date ?? null,
        isActive: c30.length > 0,
      }
    } catch (err: any) {
      if (err.message === 'rate_limited') {
        rateLimited = true
        break
      }
      // repo not found or other error — mark as unknown
      repoActivity[slug] = {
        slug,
        commits30d: 0,
        commits7d: 0,
        lastCommitAt: null,
        isActive: false,
      }
    }
  }

  // trend
  let trend30vs30: 'up' | 'flat' | 'down' = 'flat'
  if (totalCommits30_60 > 0) {
    if (totalCommits30d > totalCommits30_60 * 1.1) trend30vs30 = 'up'
    else if (totalCommits30d < totalCommits30_60 * 0.9) trend30vs30 = 'down'
  }

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
    trend30vs30,
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
