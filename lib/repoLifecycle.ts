import { getCriticalPathRole, getEffectiveTag } from './criticalPath'
import type { Repo } from './scores'

/** Public lifecycle badges — quiet ≠ failure; no "dormant" label. */
export type RepoLifecycle = 'shipping' | 'stable' | 'done'

export const LIFECYCLE_LABELS: Record<RepoLifecycle, string> = {
  shipping: 'Shipping',
  stable: 'Stable',
  done: 'Done',
}

export const LIFECYCLE_STYLES: Record<RepoLifecycle, { color: string; bg: string }> = {
  shipping: { color: '#5cb87a', bg: 'rgba(92,184,122,0.12)' },
  stable: { color: '#7a7670', bg: 'rgba(122,118,112,0.12)' },
  done: { color: '#5b9bd5', bg: 'rgba(91,155,213,0.12)' },
}

const DONE_BI_MIN_PCT = 80

/** Completed supply-lock: quiet + strong integrity; excludes living governance. */
function inferDone(repo: Repo, commitsInWindow: number): boolean {
  if (commitsInWindow > 0) return false
  if (getEffectiveTag(repo) !== 'supply-lock') return false
  if (repo.builderIntegrity.pct < DONE_BI_MIN_PCT) return false
  const role = getCriticalPathRole(repo.githubSlug)?.role
  if (role === 'governance') return false
  return true
}

export function computeRepoLifecycle(repo: Repo, commitsInWindow: number): RepoLifecycle {
  if (commitsInWindow > 0) return 'shipping'
  if (inferDone(repo, commitsInWindow)) return 'done'
  return 'stable'
}

export function lifecycleHint(lifecycle: RepoLifecycle): string | null {
  if (lifecycle === 'done') {
    return 'Launch promise held — quiet is success.'
  }
  if (lifecycle === 'stable') {
    return 'No commits this window — stable is normal for locks, waiting burns, and infra.'
  }
  return null
}
