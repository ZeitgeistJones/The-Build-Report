import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { guardAdmin } from '@/lib/admin'
import { getGitHubStats } from '@/lib/github'
import { syncBurnSnapshot } from '@/lib/burnSnapshot'
import { syncEthUsdRate } from '@/lib/ethUsdRate'
import { syncGitHubStatsSnapshot } from '@/lib/githubStatsSnapshot'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  try {
    const stats = await getGitHubStats({ fresh: true })
    const githubSnapshotUpdatedAt = await syncGitHubStatsSnapshot(stats)
    const [burnSnapshot, ethUsd] = await Promise.all([
      syncBurnSnapshot(),
      syncEthUsdRate(),
    ])
    revalidateTag('github-stats')
    revalidatePath('/')

    return NextResponse.json({
      ok: true,
      totalRepos: stats.totalRepos,
      trackableRepos: stats.trackableRepos.length,
      rateLimited: stats.rateLimited,
      lastCommitAt: stats.lastCommitAt,
      githubSnapshotUpdatedAt,
      burnSnapshot,
      ethUsd,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'GitHub refresh failed'
    const status = message === 'rate_limited' ? 429 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
