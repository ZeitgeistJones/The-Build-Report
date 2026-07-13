import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { getGitHubStats } from '@/lib/github'
import { generateAndCacheBuildBrief, loadReposForBrief, yesterdayMountainDateKey } from '@/lib/buildBrief'
import { generateAndCacheNeedle } from '@/lib/needle'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { password } = body

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  try {
    const stats = await getGitHubStats({ fresh: true })
    const repos = await loadReposForBrief(stats)
    const editionKey = yesterdayMountainDateKey()
    const brief = await generateAndCacheBuildBrief(stats, repos, editionKey)
    const needle = await generateAndCacheNeedle({ dateKey: editionKey }).catch(err => {
      console.error('[admin/build-brief] needle generation failed', err)
      return null
    })
    return NextResponse.json({
      ok: true,
      text: brief.text,
      general: brief.text,
      repoCount: brief.repoCount,
      commitCount: brief.commitCount,
      generatedAt: brief.generatedAt,
      needle: needle
        ? {
            text: needle.text,
            textNormie: needle.textNormie ?? null,
            repoCount: needle.repoCount,
            dateKey: needle.dateKey,
            generatedAt: needle.generatedAt,
          }
        : null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Build brief generation failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
