import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import {
  getGitlawbBrief,
  generateAndCacheGitlawbDigest,
} from '@/lib/gitlawbBrief'
import { yesterdayMountainDateKey } from '@/lib/buildBrief'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Admin: load or regenerate gitlawb / $GITLAWB Yesterday's Build. */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { password, action } = body

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const editionKey = yesterdayMountainDateKey()

  try {
    if (action === 'get' || !action) {
      const brief = await getGitlawbBrief(editionKey)
      return NextResponse.json({
        ok: true,
        brief,
        dateKey: editionKey,
      })
    }

    if (action === 'regenerate') {
      const digest = await generateAndCacheGitlawbDigest({ force: true, dateKey: editionKey })
      const brief = await getGitlawbBrief(editionKey)
      return NextResponse.json({
        ok: true,
        brief,
        dateKey: digest.dateKey,
        repoCount: digest.repoCount,
        commitCount: digest.commitCount,
        generatedAt: digest.generatedAt,
      })
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gitlawb brief failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
