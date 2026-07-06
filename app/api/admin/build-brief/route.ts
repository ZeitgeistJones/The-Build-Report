import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminPassword } from '@/lib/admin'
import { getGitHubStats } from '@/lib/github'
import { generateAndCacheBuildBrief, loadReposForBrief } from '@/lib/buildBrief'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { password } = body

  const ok = await verifyAdminPassword(password)
  if (!ok) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const stats = await getGitHubStats({ fresh: true })
    const repos = await loadReposForBrief(stats)
    const brief = await generateAndCacheBuildBrief(stats, repos)
    return NextResponse.json({
      ok: true,
      text: brief.text,
      general: brief.text,
      repoCount: brief.repoCount,
      commitCount: brief.commitCount,
      generatedAt: brief.generatedAt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Build brief generation failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
