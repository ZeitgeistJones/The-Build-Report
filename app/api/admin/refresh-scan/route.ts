import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { verifyAdminPassword } from '@/lib/admin'
import { getGitHubStats } from '@/lib/github'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await getGitHubStats({ fresh: true })
    revalidateTag('github-stats')
    revalidatePath('/')

    return NextResponse.json({
      ok: true,
      totalRepos: stats.totalRepos,
      trackableRepos: stats.trackableRepos.length,
      rateLimited: stats.rateLimited,
      lastCommitAt: stats.lastCommitAt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'GitHub refresh failed'
    const status = message === 'rate_limited' ? 429 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
