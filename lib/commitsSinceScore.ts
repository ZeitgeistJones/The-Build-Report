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
        // #region agent log
        fetch('http://127.0.0.1:7800/ingest/fa4fae29-c280-4441-b40c-b48d21260f18', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a33a7a' },
          body: JSON.stringify({
            sessionId: 'a33a7a',
            location: 'lib/commitsSinceScore.ts:countCommitsSinceScore',
            message: 'stale snapshot fallback — pushed after scored',
            data: {
              scoredAt,
              scoredMs,
              tsCount: commitTimestamps.length,
              newestTs: commitTimestamps[0] ?? null,
              lastCommitAt: fallback.lastCommitAt,
              pushedAt: fallback.pushedAt,
            },
            timestamp: Date.now(),
            hypothesisId: 'H1',
            runId: 'post-fix',
          }),
        }).catch(() => {})
        // #endregion
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
    if (count === 0) return '0 commits since scored'
    if (capped) return '100+ commits since scored'
    return `${count} commit${count === 1 ? '' : 's'} since scored`
  }

  if (!hasNew) return '0 commits since scored'
  return 'New commits since scored'
}
