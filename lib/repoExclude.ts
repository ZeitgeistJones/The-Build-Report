import { Redis } from '@upstash/redis'
import { Repo } from './scores'

const EXCLUDED_KEY = 'build-report:repo-excluded'
const CACHE_KEY_PREFIX = 'build-report:autoscore:v3:'

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

export async function getExcludedSlugs(): Promise<Record<string, boolean>> {
  try {
    const r = getRedis()
    const map = await r.get<Record<string, boolean>>(EXCLUDED_KEY)
    return map ?? {}
  } catch {
    return {}
  }
}

export async function isRepoExcluded(slug: string): Promise<boolean> {
  const map = await getExcludedSlugs()
  return map[slug] === true
}

async function patchAutoscoreCacheExcluded(slug: string, excluded: boolean): Promise<void> {
  try {
    const r = getRedis()
    const key = `${CACHE_KEY_PREFIX}${slug}`
    const cached = await r.get<Record<string, unknown>>(key)
    if (!cached) return
    if (excluded) {
      await r.set(key, { ...cached, excluded: true })
    } else {
      const { excluded: _, ...rest } = cached
      await r.set(key, rest)
    }
  } catch {
    // non-fatal
  }
}

export async function setRepoExcluded(slug: string, excluded: boolean): Promise<void> {
  const r = getRedis()
  const map = await getExcludedSlugs()
  if (excluded) {
    map[slug] = true
  } else {
    delete map[slug]
  }
  await r.set(EXCLUDED_KEY, map)
  await patchAutoscoreCacheExcluded(slug, excluded)
}

export function applyExcludedToRepos(repos: Repo[], excludedMap: Record<string, boolean>): Repo[] {
  return repos.map(repo => ({
    ...repo,
    excluded: excludedMap[repo.githubSlug] === true || repo.excluded === true,
  }))
}

export function filterPublicRepos(repos: Repo[]): Repo[] {
  return repos.filter(r => !r.excluded)
}
