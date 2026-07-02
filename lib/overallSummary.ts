import { Redis } from '@upstash/redis'
import Anthropic from '@anthropic-ai/sdk'
import { stripMarkdown } from './textCleanup'
import { OverallGradeContext } from './overallGrade'

const SUMMARY_KEY = 'build-report:overall-summary'

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

function formatContext(ctx: OverallGradeContext): string {
  const tm = ctx.tokenMechanic
    ? `Token mechanic: ${ctx.tokenMechanic.letter} (${ctx.tokenMechanic.pct}%)`
    : 'Token mechanic: unavailable'
  const builder = ctx.builder
    ? `Builder activity: ${ctx.builder.letter} (${ctx.builder.pct}%)`
    : 'Builder activity: unavailable (GitHub data missing — weight redistributed)'
  const integrity = `Builder integrity: ${ctx.integrity.letter} (${ctx.integrity.pct}%)`
  const overall = `Overall: ${ctx.overall.letter} (${ctx.overall.pct}%) — ${ctx.overall.reposScored} repos scored`

  const dist = Object.entries(ctx.gradeDistribution)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}: ${n}`)
    .join(', ')

  const tags = ctx.dominantTags
    .slice(0, 4)
    .map(t => `${t.tag} (${t.count})`)
    .join(', ')

  const active = ctx.mostActiveRepos
    .map(r => `${r.name} (${r.commits} commits)`)
    .join(', ')

  const activity = ctx.builderStats
    ? `30d activity: ${ctx.builderStats.commits} commits, ${ctx.builderStats.activeDays} active days, ${ctx.builderStats.newRepos} new repos`
    : '30d activity: unavailable'

  return [overall, tm, builder, integrity, `Grade distribution (repo scores): ${dist}`, `Dominant tags: ${tags}`, `Most active repos (30d): ${active || 'none'}`, activity].join('\n')
}

async function generateOverallSummary(ctx: OverallGradeContext): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are summarizing the overall health of the clawdbotatg GitHub ecosystem for $CLAWD holders.

${formatContext(ctx)}

Write exactly 2 sentences of plain English summarizing the overall grade and what it means for holders.

Rules:
- Be accurate about the scores shown. Acknowledge weaknesses honestly.
- Frame the picture in terms of trajectory and context, not a demoralizing snapshot.
- Avoid demoralizing language. A low token mechanic score during an infrastructure-heavy phase should be framed like "infrastructure phase — consumer apps are the expected next unlock" rather than "fails to deliver holder value."
- Infrastructure repos scoring low on token mechanic: frame as "foundational layer — value shows up in downstream consumer apps."
- Dormant but stable repos: note as "stable; foundational work complete" rather than only "low activity."
- Still be honest — do not invent positive framing that is not warranted by the data.
- No bullet points, no markdown.`

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
  try {
    const r = getRedis()
    const cached = await r.get<string>(SUMMARY_KEY)
    if (cached) return stripMarkdown(cached)
  } catch {
    // fall through
  }

  const summary = await generateOverallSummary(ctx)
  if (!summary) return null

  try {
    const r = getRedis()
    await r.set(SUMMARY_KEY, summary, { ex: 86400 })
  } catch {
    // non-fatal
  }

  return summary
}
