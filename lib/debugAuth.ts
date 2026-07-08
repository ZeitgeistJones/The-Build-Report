import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Guards internal debug/diagnostic routes. These routes disclose scoring
 * internals and trigger expensive external calls, so they must not be public.
 *
 * Access requires `?key=<CRON_SECRET>` (timing-safe compared). When the check
 * fails we return 404 rather than 401 so the route's existence isn't confirmed.
 * Returns a NextResponse to short-circuit on denial, or null when authorized.
 */
export function guardDebugRoute(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  const provided = req.nextUrl.searchParams.get('key') ?? ''

  if (secret && provided) {
    const a = Buffer.from(provided)
    const b = Buffer.from(secret)
    if (a.length === b.length && timingSafeEqual(a, b)) return null
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
