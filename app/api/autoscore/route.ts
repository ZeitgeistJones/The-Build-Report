import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { extractClientIp, verifyAdminPassword } from '@/lib/admin'
import { getRedis } from '@/lib/redis'
import { runAutoscorePipeline } from '@/lib/autoscorePipeline'

export const maxDuration = 300

const ratelimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'build-report:rl:admin-autoscore',
})

const failLimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(15, '1 h'),
  prefix: 'build-report:rl:admin-autoscore-fail',
})

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req)

  const { success: rateOk } = await ratelimit.limit(ip)
  if (!rateOk) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded — try again later' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const password = body?.password

  if (!(await verifyAdminPassword(password))) {
    await failLimit.limit(ip)
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAutoscorePipeline()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    console.error('[admin-autoscore] pipeline failed:', err)
    return NextResponse.json({ ok: false, error: 'Autoscore failed' }, { status: 500 })
  }
}
