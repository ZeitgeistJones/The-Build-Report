import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { verifyAdminPassword } from '@/lib/admin'
import { getRedis } from '@/lib/redis'
import { runAutoscorePipeline } from '@/lib/autoscorePipeline'

export const maxDuration = 300

const ratelimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'build-report:rl:admin-autoscore',
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded — try again later' }, { status: 429 })
  }

  try {
    const result = await runAutoscorePipeline()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Autoscore failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
