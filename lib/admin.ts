import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
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

  const a = Buffer.from(password)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}
