import { NextRequest, NextResponse } from 'next/server'
import { getGitHubStats } from '@/lib/github'
import { REPOS } from '@/lib/scores'
import { runAutoScores } from '@/lib/autoscore'
import { shouldSkipRepo } from '@/lib/repoFilters'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await getGitHubStats()
    const knownRepoSlugs = new Set(REPOS.map(r => r.githubSlug))
    const githubRepos = stats?.trackableRepos ?? []
    const unscoredRepos = githubRepos.filter(
      repo => !knownRepoSlugs.has(repo.name) && !shouldSkipRepo(repo.name),
    )

    const scored = await runAutoScores(unscoredRepos)

    return NextResponse.json({
      ok: true,
      found: unscoredRepos.length,
      scoredReturned: scored.length,
      names: scored.map(r => r.name),
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Autoscore failed' },
      { status: 500 }
    )
  }
}
