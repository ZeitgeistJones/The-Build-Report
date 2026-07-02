import { Redis } from '@upstash/redis'
import Anthropic from '@anthropic-ai/sdk'

const CHRONICLE_REPO = 'clawdbotatg/clawd-chronicle'
const SUMMARY_KEY = 'build-report:chronicle-summary'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

let redis: Redis | null = null

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
}

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

async function fetchChronicleCommits(): Promise<ChronicleCommit[]> {
  try {
    const raw = await chronicleFetch(`/repos/${CHRONICLE_REPO}/commits?per_page=5`)
    if (!Array.isArray(raw)) return []
    return parseCommits(raw)
  } catch {
    return []
  }
}

async function generateChronicleSummary(commits: ChronicleCommit[]): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY || commits.length === 0) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const list = commits.map((c, i) => `${i + 1}. ${c.message}`).join('\n')

  const prompt = `The clawdbotatg Chronicle is a living document tracking what the builder is working on. Here are the 5 most recent commit messages:

${list}

Write 3–4 sentences of plain English summarizing what was recently added or updated in the Chronicle. No bullet points, no markdown.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return text || null
  } catch {
    return null
  }
}

async function getChronicleSummary(commits: ChronicleCommit[]): Promise<string | null> {
  try {
    const r = getRedis()
    const cached = await r.get<string>(SUMMARY_KEY)
    if (cached) return cached
  } catch {
    // fall through to generate
  }

  const summary = await generateChronicleSummary(commits)
  if (!summary) return null

  try {
    const r = getRedis()
    await r.set(SUMMARY_KEY, summary, { ex: 86400 })
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

  const summary = await getChronicleSummary(commits)

  return { lastUpdated, summary }
}
