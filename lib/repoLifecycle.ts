import { getEffectiveTag, isCriticalPath, isDoneRepo } from './criticalPath'
import { hasShippingLeverageTag } from './rubrics/shippingLeverage'
import type { Repo, Status } from './scores'

export type RepoLifecycle = 'shipping' | 'supporting' | 'done' | 'dormant'

export const LIFECYCLE_LABELS: Record<RepoLifecycle, string> = {
  shipping: 'Shipping',
  supporting: 'Supporting',
  done: 'Done',
  dormant: 'Dormant',
}

export const LIFECYCLE_STYLES: Record<RepoLifecycle, { color: string; bg: string }> = {
  shipping: { color: '#5cb87a', bg: 'rgba(92,184,122,0.12)' },
  supporting: { color: '#7a7670', bg: 'rgba(122,118,112,0.12)' },
  done: { color: '#5b9bd5', bg: 'rgba(91,155,213,0.12)' },
  dormant: { color: '#d4943a', bg: 'rgba(212,148,58,0.12)' },
}

/**
 * Lifecycle for display — separate from GitHub push status.
 * Quiet critical-path infra = supporting (healthy), not dormant failure.
 */
export function computeRepoLifecycle(
  repo: Repo,
  commitsInWindow: number,
): RepoLifecycle {
  if (isDoneRepo(repo.githubSlug)) return 'done'

  const tag = getEffectiveTag(repo)

  if (commitsInWindow > 0) return 'shipping'

  if (isCriticalPath(repo.githubSlug) || hasShippingLeverageTag(tag)) {
    return 'supporting'
  }

  if (repo.status === 'archived' || repo.status === 'dormant') {
    return 'dormant'
  }

  return 'supporting'
}

export function lifecycleHint(lifecycle: RepoLifecycle, status: Status): string | null {
  if (lifecycle === 'done') {
    return 'Launch promise held — quiet is success.'
  }
  if (lifecycle === 'supporting') {
    return 'Stable infra — no recent commits expected.'
  }
  if (lifecycle === 'dormant' && status === 'dormant') {
    return 'No recent activity in this window.'
  }
  return null
}
