import { generateText, hasLlmApiKey } from '@/lib/llm'
import { getRedis } from '@/lib/redis'

const CHRONICLE_REPO = 'clawdbotatg/clawd-chronicle'
const SUMMARY_KEY_PREFIX = 'build-report:chronicle-summary:'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

export interface ChronicleCommit {
  date: string
  message: string
  sha: string
}

export interface ChronicleBannerData {
  lastUpdated: { daysAgo: number; label: string; message: string } | null
  summary: string | null
}

async function chronicleFetch(path: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`

  const res = await fetch(`https://api.github.com${path}`, {
    headers,
    next: { revalidate: 3600, tags: ['github-chronicle'] },
  })

  if (!res.ok) return null
  return res.json()
}

async function fetchCommitDiff(sha: string): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.diff',
  }
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`

  try {
    const res = await fetch(`https://api.github.com/repos/${CHRONICLE_REPO}/commits/${sha}`, {
      headers,
      next: { revalidate: 3600, tags: ['github-chronicle'] },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function firstLine(message: string): string {
  return message.split('\n')[0].trim()
}

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function daysAgoLabel(dateStr: string): { daysAgo: number; label: string } {
  const d = new Date(dateStr)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (days === 0) return { daysAgo: 0, label: 'today' }
  if (days === 1) return { daysAgo: 1, label: '1 day ago' }
  return { daysAgo: days, label: `${days} days ago` }
}

function parseCommits(raw: any[]): ChronicleCommit[] {
  return raw.map(c => ({
    date: c.commit?.author?.date ?? '',
    message: firstLine(c.commit?.message ?? ''),
    sha: c.sha ?? '',
  })).filter(c => c.date && c.message)
}

function truncateDiff(text: string, max = 12000): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n\n[diff truncated]`
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchChronicleCommits(): Promise<ChronicleCommit[]> {
  try {
    const raw = await chronicleFetch(`/repos/${CHRONICLE_REPO}/commits?per_page=1`)
    if (!Array.isArray(raw)) return []
    return parseCommits(raw)
  } catch {
    return []
  }
}

async function generateChronicleSummary(latest: ChronicleCommit, diff: string): Promise<string | null> {
  if (!hasLlmApiKey() || !diff.trim()) return null

  const prompt = `The clawdbotatg Chronicle is a living document tracking what the builder is working on.

Most recent commit: ${latest.message}

Diff of what changed:
${truncateDiff(diff)}

Write 3–4 sentences of plain English summarizing what was added or updated in this Chronicle commit. No bullet points, no markdown.`

  try {
    const { text } = await generateText({
      prompt,
      maxTokens: 150,
      label: 'chronicle',
    })
    return text ? stripMarkdown(text) : null
  } catch {
    return null
  }
}

async function getChronicleSummary(latest: ChronicleCommit): Promise<string | null> {
  const summaryKey = `${SUMMARY_KEY_PREFIX}${latest.sha}`

  try {
    const r = getRedis()
    const cached = await r.get<string>(summaryKey)
    if (cached) return stripMarkdown(cached)
  } catch {
    // fall through to generate
  }

  const diff = await fetchCommitDiff(latest.sha)
  if (!diff) return null

  const summary = await generateChronicleSummary(latest, diff)
  if (!summary) return null

  try {
    const r = getRedis()
    await r.set(summaryKey, summary, { ex: 86400 })
  } catch {
    // non-fatal
  }

  return summary
}

export async function getChronicleBannerData(): Promise<ChronicleBannerData> {
  const commits = await fetchChronicleCommits()

  if (commits.length === 0) {
    return { lastUpdated: null, summary: null }
  }

  const latest = commits[0]
  const { daysAgo, label } = daysAgoLabel(latest.date)
  const lastUpdated = {
    daysAgo,
    label,
    message: truncate(latest.message),
  }

  const summary = await getChronicleSummary(latest)

  return { lastUpdated, summary }
}
