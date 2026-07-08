import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from '@/lib/redis'

export function extractClientIp(req: NextRequest): string {
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]!
  }

  return 'unknown'
}

export async function getAdminNotes(): Promise<Record<string, string>> {
  try {
    const r = getRedis()
    const notes = await r.get<Record<string, string>>('build-report:admin-notes')
    return notes ?? {}
  } catch {
    return {}
  }
}

export async function setAdminNote(repoId: string, note: string): Promise<void> {
  const r = getRedis()
  const existing = await getAdminNotes()
  if (note.trim() === '') {
    delete existing[repoId]
  } else {
    existing[repoId] = note.trim()
  }
  await r.set('build-report:admin-notes', existing)
}

export async function verifyAdminPassword(password: unknown): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected || typeof password !== 'string' || password.length === 0) return false

  // Hash both sides to a fixed length before comparing so the compare does not
  // leak the expected password length via an early length-mismatch return.
  const a = createHash('sha256').update(password).digest()
  const b = createHash('sha256').update(expected).digest()

  return timingSafeEqual(a, b)
}

// Per-IP limiter for password-gated admin endpoints. Generous enough for real
// admin use, tight enough to blunt brute-force attempts. Consumed on every
// attempt (success or fail).
const adminAttemptLimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(20, '10 m'),
  prefix: 'build-report:rl:admin-attempt',
})

/**
 * Rate-limits and authenticates an admin request. Returns a NextResponse to
 * short-circuit on rate-limit (429) or bad password (401), or null when the
 * request is authorized and may proceed.
 */
export async function guardAdmin(req: NextRequest, password: unknown): Promise<NextResponse | null> {
  const ip = extractClientIp(req)
  const { success } = await adminAttemptLimit.limit(ip)
  if (!success) {
    return NextResponse.json({ ok: false, error: 'Rate limit exceeded — try again later' }, { status: 429 })
  }
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
