import { getRedis } from '@/lib/redis'

export type RepoCollectionId = 'cv-related' | 'clawd-gated'

export type RepoCollectionDef = {
  id: RepoCollectionId
  label: string
  filterLabel: string
  tooltip: string
  defaultSlugs: string[]
}

/** Admin-editable filter groups — not the same as scoring tags (direct, infra, etc.). */
export const REPO_COLLECTIONS: RepoCollectionDef[] = [
  {
    id: 'cv-related',
    label: 'CV & governance',
    filterLabel: 'CV & gov',
    tooltip:
      'Conviction / CV staking and governance surfaces. CV burns are not CLAWD burns — Larv.ai, conclave-style repos.',
    defaultSlugs: ['clawdviction', 'conclave'],
  },
  {
    id: 'clawd-gated',
    label: 'CLAWD-gated',
    filterLabel: 'CLAWD-gated',
    tooltip:
      'Holder-gated flows — CLAWD balance, stake, or access required (e.g. denar.ai, gasless agent registration, Leftclaw).',
    defaultSlugs: [
      'clawd-talk-to-your-wallet',
      'sponsor-clawdbotatg-eth',
      'leftclaw-services',
      'clawd-pfp-market',
    ],
  },
]

const COLLECTIONS_KEY = 'build-report:repo-collections'
const FORCE_INCLUDE_KEY = 'build-report:repo-trackable-force-include'

type CollectionPatch = { added: string[]; removed: string[] }
type CollectionsStore = Partial<Record<RepoCollectionId, CollectionPatch>>

function emptyPatch(): CollectionPatch {
  return { added: [], removed: [] }
}

function defFor(id: RepoCollectionId): RepoCollectionDef {
  const d = REPO_COLLECTIONS.find(c => c.id === id)
  if (!d) throw new Error(`Unknown collection: ${id}`)
  return d
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase()
}

function effectiveSlugs(id: RepoCollectionId, store: CollectionsStore): string[] {
  const def = defFor(id)
  const patch = store[id] ?? emptyPatch()
  const added = patch.added.map(normalizeSlug)
  const removed = new Set(patch.removed.map(normalizeSlug))
  const out = new Set<string>()
  for (const s of def.defaultSlugs) {
    const slug = normalizeSlug(s)
    if (!removed.has(slug)) out.add(slug)
  }
  for (const s of added) {
    if (!removed.has(s)) out.add(s)
  }
  return Array.from(out).sort()
}

export async function getCollectionsStore(): Promise<CollectionsStore> {
  try {
    const r = getRedis()
    return (await r.get<CollectionsStore>(COLLECTIONS_KEY)) ?? {}
  } catch {
    return {}
  }
}

export async function getAllCollectionSlugs(): Promise<Record<RepoCollectionId, string[]>> {
  const store = await getCollectionsStore()
  return {
    'cv-related': effectiveSlugs('cv-related', store),
    'clawd-gated': effectiveSlugs('clawd-gated', store),
  }
}

export function collectionIdsForSlug(
  slug: string,
  collections: Record<RepoCollectionId, string[]>,
): RepoCollectionId[] {
  const normalized = normalizeSlug(slug)
  const ids: RepoCollectionId[] = []
  for (const def of REPO_COLLECTIONS) {
    if (collections[def.id].some(s => normalizeSlug(s) === normalized)) ids.push(def.id)
  }
  return ids
}

export async function addCollectionSlug(collectionId: RepoCollectionId, slug: string): Promise<void> {
  const normalized = normalizeSlug(slug)
  if (!normalized) return
  const r = getRedis()
  const store = await getCollectionsStore()
  const patch = store[collectionId] ?? emptyPatch()
  patch.removed = patch.removed.filter(s => normalizeSlug(s) !== normalized)
  if (!patch.added.some(s => normalizeSlug(s) === normalized)) {
    patch.added.push(normalized)
  }
  store[collectionId] = patch
  await r.set(COLLECTIONS_KEY, store)
}

export async function removeCollectionSlug(collectionId: RepoCollectionId, slug: string): Promise<void> {
  const normalized = normalizeSlug(slug)
  if (!normalized) return
  const def = defFor(collectionId)
  const r = getRedis()
  const store = await getCollectionsStore()
  const patch = store[collectionId] ?? emptyPatch()
  patch.added = patch.added.filter(s => normalizeSlug(s) !== normalized)
  const isDefault = def.defaultSlugs.some(s => normalizeSlug(s) === normalized)
  if (isDefault && !patch.removed.some(s => normalizeSlug(s) === normalized)) {
    patch.removed.push(normalized)
  }
  store[collectionId] = patch
  await r.set(COLLECTIONS_KEY, store)
}

export async function getTrackableForceInclude(): Promise<string[]> {
  try {
    const r = getRedis()
    const list = await r.get<string[]>(FORCE_INCLUDE_KEY)
    return list?.map(normalizeSlug).filter(Boolean) ?? []
  } catch {
    return []
  }
}

export async function getTrackableForceIncludeSet(): Promise<Set<string>> {
  return new Set(await getTrackableForceInclude())
}

export async function addTrackableForceInclude(slug: string): Promise<void> {
  const normalized = normalizeSlug(slug)
  if (!normalized) return
  const r = getRedis()
  const list = await getTrackableForceInclude()
  if (!list.includes(normalized)) {
    await r.set(FORCE_INCLUDE_KEY, [...list, normalized])
  }
}

export async function removeTrackableForceInclude(slug: string): Promise<void> {
  const normalized = normalizeSlug(slug)
  const r = getRedis()
  const list = await getTrackableForceInclude()
  await r.set(
    FORCE_INCLUDE_KEY,
    list.filter(s => s !== normalized),
  )
}

export function isRepoCollectionId(value: string): value is RepoCollectionId {
  return REPO_COLLECTIONS.some(c => c.id === value)
}

/** For admin auth payload — defaults + patches. */
export async function getCollectionsAdminState(): Promise<{
  collections: Record<RepoCollectionId, string[]>
  forceInclude: string[]
  store: CollectionsStore
}> {
  const store = await getCollectionsStore()
  const collections = {
    'cv-related': effectiveSlugs('cv-related', store),
    'clawd-gated': effectiveSlugs('clawd-gated', store),
  }
  const forceInclude = await getTrackableForceInclude()
  return { collections, forceInclude, store }
}
