import { Redis } from '@upstash/redis'
import Anthropic from '@anthropic-ai/sdk'
import { getRedis } from '@/lib/redis'
import { stripMarkdown } from './textCleanup'
import { LetterBucketDistribution, OverallGradeContext } from './overallGrade'
import { Period } from './grades'

const SUMMARY_KEYS: Record<Period, string> = {
  '30d': 'build-report:overall-summary-v2',
  '7d': 'build-report:overall-summary-7d-v2',
  '60d': 'build-report:overall-summary-60d-v2',
}

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7-day',
  '30d': '30-day',
  '60d': '60-day',
}

const PERIOD_FOCUS: Record<Period, string> = {
  '7d': 'Focus on what happened this week: recent momentum, where commits landed, and the short-term signal for holders.',
  '30d': 'Focus on the current month: what is being built right now and what the grades mean for holders today.',
  '60d': 'Focus on the broader two-month picture: sustained patterns, whether activity is consistent or bursty, and how this week\'s work fits the longer arc.',
}

function formatDistribution(dist: LetterBucketDistribution): string {
  return Object.entries(dist)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}: ${n}`)
    .join(', ') || 'none'
}

function formatContext(ctx: OverallGradeContext): string {
  const tm = ctx.tokenMechanic
    ? `Token mechanic: ${ctx.tokenMechanic.letter} (${ctx.tokenMechanic.pct}%)`
    : 'Token mechanic: unavailable'
  const builder = ctx.builder
    ? `Builder activity: ${ctx.builder.letter} (${ctx.builder.pct}%)`
    : 'Builder activity: unavailable (GitHub data missing — weight redistributed)'
  const integrity = `Builder integrity: ${ctx.integrity.letter} (${ctx.integrity.pct}%)`
  const overall = `Overall (${PERIOD_LABELS[ctx.period]} window): ${ctx.overall.letter} (${ctx.overall.pct}%)`
  const reposScored = `Repos scored: ${ctx.overall.reposScored}`

  const tags = ctx.dominantTags
    .slice(0, 4)
    .map(t => `${t.tag} (${t.count})`)
    .join(', ')

  const active = ctx.mostActiveRepos
    .map(r => `${r.name} (${r.commits} commits)`)
    .join(', ')

  const activity = ctx.builderStats
    ? `${PERIOD_LABELS[ctx.period]} activity: ${ctx.builderStats.commits} commits, ${ctx.builderStats.activeDays} active days, ${ctx.builderStats.newRepos} new repos`
    : `${PERIOD_LABELS[ctx.period]} activity: unavailable`

  return [
    overall,
    reposScored,
    tm,
    builder,
    integrity,
    `Repos with token mechanic grade: ${ctx.reposWithTokenMechanicGrade}`,
    `Token mechanic grade distribution (${ctx.reposWithTokenMechanicGrade} grades): ${formatDistribution(ctx.tokenMechanicDistribution)}`,
    `Builder integrity grade distribution (${ctx.overall.reposScored} grades): ${formatDistribution(ctx.builderIntegrityDistribution)}`,
    `Dominant tags: ${tags}`,
    `Most active repos (${ctx.period}): ${active || 'none'}`,
    activity,
  ].join('\n')
}

const SUMMARY_RULES = `Write exactly 2 sentences of plain English. Sound like a knowledgeable $CLAWD holder talking straight — direct and human, not corporate or hype-y.

Rules:
- Be accurate about the scores shown. Acknowledge weaknesses honestly.
- Distribution numbers are grade counts per axis, not repo counts. Never say "X F-graded repos" unless X equals repos scored. If many token mechanic grades are F, say that — do not imply more repos exist than repos scored.
- Frame the picture in terms of trajectory and context, not a demoralizing snapshot.
- Avoid stiff phrasing like "foundational layers are expected to surface holder value through downstream consumer applications." Prefer plain talk: "the infrastructure being laid now should pay off when consumer apps with real burn mechanics ship."
- Heavy infra phase with low token mechanic: say the build work should matter once consumer apps with burns go live — don't dress it up in jargon.
- Dormant but stable repos: "stable; core work is done" beats only "low activity."
- Still be honest — do not invent positive framing that is not warranted by the data.
- No bullet points, no markdown.`

async function generateOverallSummary(ctx: OverallGradeContext): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are summarizing the overall health of the clawdbotatg GitHub ecosystem for $CLAWD holders.

${formatContext(ctx)}

${PERIOD_FOCUS[ctx.period]}

${SUMMARY_RULES}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return text ? stripMarkdown(text) : null
  } catch {
    return null
  }
}

export async function getOverallSummary(ctx: OverallGradeContext): Promise<string | null> {
  // Skip Claude/Redis during next build static collection — summaries run at request time.
  if (process.env.NEXT_PHASE === 'phase-production-build') return null

  const key = SUMMARY_KEYS[ctx.period]

  try {
    const r = getRedis()
    const cached = await r.get<string>(key)
    if (cached) return stripMarkdown(cached)
  } catch {
    // fall through
  }

  const summary = await generateOverallSummary(ctx)
  if (!summary) return null

  try {
    const r = getRedis()
    await r.set(key, summary, { ex: 86400 })
  } catch {
    // non-fatal
  }

  return summary
}

export const OVERALL_SUMMARY_CACHE_KEYS = Object.values(SUMMARY_KEYS)

export async function bustOverallSummaryCache(redis: Redis): Promise<void> {
  await Promise.all(OVERALL_SUMMARY_CACHE_KEYS.map(key => redis.del(key)))
}
