import { Redis } from '@upstash/redis'

let redis: Redis | null = null

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
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

export async function verifyAdminPassword(password: string): Promise<boolean> {
  return password === process.env.ADMIN_PASSWORD
}
