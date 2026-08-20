import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { shouldSkipRepo } from '@/lib/repoFilters'
import { isRepoExcluded } from '@/lib/repoExclude'
import { runRescorePipeline, scheduleNeedleRefreshAfterRescore } from '@/lib/rescorePipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Admin-only free Score/Rescore — no wallet or payment. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password
  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const repoSlug = typeof body.repoSlug === 'string' ? body.repoSlug.trim() : ''
  if (!repoSlug) {
    return NextResponse.json({ ok: false, error: 'Missing repoSlug' }, { status: 400 })
  }
  if (shouldSkipRepo(repoSlug)) {
    return NextResponse.json({ ok: false, error: 'Repo not eligible for scoring' }, { status: 400 })
  }
  if (await isRepoExcluded(repoSlug)) {
    return NextResponse.json({ ok: false, error: 'Repo is excluded from scoring' }, { status: 400 })
  }

  try {
    const pipeline = await runRescorePipeline(repoSlug)
    scheduleNeedleRefreshAfterRescore()
    return NextResponse.json({
      ok: true,
      repo: pipeline.repo,
      changeSummary: pipeline.changeSummary,
      rescoreMeta: pipeline.rescoreMeta,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Admin rescore failed'
    console.error('[admin/rescore]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
