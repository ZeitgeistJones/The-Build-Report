export const COMMIT_CAP = 100

export function parseScoredAtMs(scoredAt: string | null | undefined): number | null {
  if (!scoredAt?.trim()) return null
  const ms = new Date(scoredAt.trim()).getTime()
  return Number.isNaN(ms) ? null : ms
}

export function hasCommitAfterScore(
  scoredAt: string | null | undefined,
  lastCommitAt: string | null | undefined,
  pushedAt: string | null | undefined,
): boolean {
  const scoredMs = parseScoredAtMs(scoredAt)
  if (scoredMs === null) return false
  const last = lastCommitAt ?? pushedAt
  if (!last) return false
  const lastMs = new Date(last).getTime()
  return !Number.isNaN(lastMs) && lastMs > scoredMs
}

export function countCommitsSinceScore(
  scoredAt: string | null | undefined,
  commitTimestamps: string[] | null | undefined,
  fallback?: { lastCommitAt: string | null; pushedAt: string | null },
): { count: number; exact: boolean; hasNew: boolean; capped: boolean } {
  const scoredMs = parseScoredAtMs(scoredAt)
  if (scoredMs === null) {
    return { count: 0, exact: true, hasNew: false, capped: false }
  }

  if (commitTimestamps?.length) {
    const count = commitTimestamps.filter(ts => {
      const ms = new Date(ts).getTime()
      return !Number.isNaN(ms) && ms > scoredMs
    }).length
    return {
      count,
      exact: true,
      hasNew: count > 0,
      capped: count >= COMMIT_CAP,
    }
  }

  const hasNew = hasCommitAfterScore(
    scoredAt,
    fallback?.lastCommitAt ?? null,
    fallback?.pushedAt ?? null,
  )
  return { count: hasNew ? -1 : 0, exact: false, hasNew, capped: false }
}

export function commitsSinceScoreLabel(
  scoredAt: string | null | undefined,
  commitTimestamps: string[] | null | undefined,
  fallback?: { lastCommitAt: string | null; pushedAt: string | null },
): string {
  const { count, exact, hasNew, capped } = countCommitsSinceScore(
    scoredAt,
    commitTimestamps,
    fallback,
  )

  if (exact) {
    if (count === 0) return '0 commits since scored'
    if (capped) return '100+ commits since scored'
    return `${count} commit${count === 1 ? '' : 's'} since scored`
  }

  if (!hasNew) return '0 commits since scored'
  return 'New commits since scored'
}
