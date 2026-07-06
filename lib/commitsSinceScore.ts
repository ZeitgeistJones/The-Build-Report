export const COMMIT_CAP = 100

export function parseScoredAtMs(scoredAt: string | null | undefined): number | null {
  if (!scoredAt?.trim()) return null
  const ms = new Date(scoredAt.trim()).getTime()
  return Number.isNaN(ms) ? null : ms
}

export function newestKnownActivityMs(
  commitTimestamps: string[] | null | undefined,
  fallback?: { lastCommitAt: string | null; pushedAt: string | null },
): number | null {
  let max: number | null = null
  for (const ts of commitTimestamps ?? []) {
    const ms = new Date(ts).getTime()
    if (!Number.isNaN(ms)) max = max === null ? ms : Math.max(max, ms)
  }
  for (const raw of [fallback?.lastCommitAt, fallback?.pushedAt]) {
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (!Number.isNaN(ms)) max = max === null ? ms : Math.max(max, ms)
  }
  return max
}

/** True when the score timestamp is newer than every indexed commit/push (e.g. bulk regen after last activity). */
export function isScoredAfterLastKnownActivity(
  scoredAt: string | null | undefined,
  commitTimestamps: string[] | null | undefined,
  fallback?: { lastCommitAt: string | null; pushedAt: string | null },
): boolean {
  const scoredMs = parseScoredAtMs(scoredAt)
  const newestMs = newestKnownActivityMs(commitTimestamps, fallback)
  if (scoredMs === null || newestMs === null) return false
  return scoredMs > newestMs
}

export function hasCommitAfterScore(
  scoredAt: string | null | undefined,
  lastCommitAt: string | null | undefined,
  pushedAt: string | null | undefined,
): boolean {
  const scoredMs = parseScoredAtMs(scoredAt)
  if (scoredMs === null) return false

  // Either signal counts — push can move without a new commit author date in the snapshot.
  for (const raw of [lastCommitAt, pushedAt]) {
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (!Number.isNaN(ms) && ms > scoredMs) return true
  }
  return false
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

    // Stale snapshot: scoredAt can be newer than every cached timestamp (e.g. bulk regen)
    // while pushedAt/lastCommitAt still moved — don't show a false exact zero.
    if (count === 0 && fallback) {
      const hasNew = hasCommitAfterScore(
        scoredAt,
        fallback.lastCommitAt ?? null,
        fallback.pushedAt ?? null,
      )
      if (hasNew) {
        return { count: -1, exact: false, hasNew: true, capped: false }
      }
    }

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
    if (count === 0) {
      if (isScoredAfterLastKnownActivity(scoredAt, commitTimestamps, fallback)) {
        return 'Up to date at last score'
      }
      return '0 commits since scored'
    }
    if (capped) return '100+ commits since scored'
    return `${count} commit${count === 1 ? '' : 's'} since scored`
  }

  if (!hasNew) {
    if (isScoredAfterLastKnownActivity(scoredAt, commitTimestamps, fallback)) {
      return 'Up to date at last score'
    }
    return '0 commits since scored'
  }
  return 'New commits since scored'
}
