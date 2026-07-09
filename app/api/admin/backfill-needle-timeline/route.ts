import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { getRescoreSummaries } from '@/lib/rescoreSummaries'
import { backfillRescoreTimeline } from '@/lib/scoreHistory'
import { REPOS } from '@/lib/scores'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const slugs = REPOS.map(r => r.githubSlug)
  const summaries = await getRescoreSummaries(slugs)

  const entries = Object.entries(summaries).map(([slug, meta]) => ({
    slug,
    rescoreAt: meta.rescoreAt,
  }))

  const count = await backfillRescoreTimeline(entries)

  return NextResponse.json({ ok: true, backfilled: count, totalRepos: slugs.length })
}
