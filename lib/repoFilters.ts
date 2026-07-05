/** Repos excluded from listing, autoscore, and recent-unscored surfacing. */
export function shouldSkipRepo(
  name: string,
  opts?: { forceInclude?: ReadonlySet<string> },
): boolean {
  if (opts?.forceInclude?.has(name)) return false

  if (name === 'leftclaw-service-job' || name === '.github') return true
  if (name.startsWith('leftclaw-service-job')) return true
  if (name.startsWith('cv-')) return true
  if (name.startsWith('job-')) return true
  return false
}

export function isAutoInferredNote(note: string | null | undefined): boolean {
  if (!note) return false
  return note.startsWith('Scores auto-inferred') || note.startsWith('Live AI score')
}
