import { getRedis } from '@/lib/redis'

const CHRONICLE_CONTEXT_KEY = 'build-report:chronicle-context'

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
