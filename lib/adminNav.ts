/** Stable Admin section hashes. Keep #utility working. */

const HASH_ALIASES: Record<string, string> = {
  wire: 'admin-wire',
  builds: 'admin-builds',
  brief: 'admin-brief',
  needle: 'admin-needle',
  overheard: 'admin-overheard',
  podcast: 'admin-podcast-review',
  'podcast-review': 'admin-podcast-review',
  spotted: 'admin-spotted',
  github: 'admin-github',
  'admin-utility': 'utility',
  rescore: 'admin-rescore',
  behind: 'admin-rescore',
  'catch-up': 'admin-rescore',
}

export function resolveAdminSectionId(hash: string): string | null {
  const raw = hash.replace(/^#/, '')
  if (!raw) return null
  return HASH_ALIASES[raw] ?? raw
}
