import { Redis } from '@upstash/redis'

const CHRONICLE_CONTEXT_KEY = 'build-report:chronicle-context'

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

export async function getChronicleContext(): Promise<string | null> {
  try {
    const r = getRedis()
    const value = await r.get<string>(CHRONICLE_CONTEXT_KEY)
    return value?.trim() || null
  } catch {
    return null
  }
}

export async function setChronicleContext(text: string): Promise<void> {
  const r = getRedis()
  const trimmed = text.trim()
  if (trimmed) {
    await r.set(CHRONICLE_CONTEXT_KEY, trimmed)
  } else {
    await r.del(CHRONICLE_CONTEXT_KEY)
  }
}
