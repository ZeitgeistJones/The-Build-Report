import type { CSSProperties } from 'react'
import type { Tag } from '@/lib/scores'
import type { RepoCollectionId } from '@/lib/repoCollections'
import type { RepoLifecycle } from '@/lib/repoLifecycle'

/** Shared pill styles — one vocabulary for repo metadata badges. */
export const BADGE_BASE: CSSProperties = {
  fontSize: '10px',
  padding: '2px 7px',
  borderRadius: '99px',
  fontWeight: 500,
  letterSpacing: '0.02em',
  display: 'inline-block',
  lineHeight: 1.4,
}

export function neutralBadgeStyle(): CSSProperties {
  return {
    ...BADGE_BASE,
    color: 'var(--text-secondary)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
  }
}

export function accentBadgeStyle(): CSSProperties {
  return {
    ...BADGE_BASE,
    color: 'var(--accent)',
    background: 'var(--accent-dim)',
    border: '1px solid var(--accent-border)',
  }
}

export function warningBadgeStyle(): CSSProperties {
  return {
    ...BADGE_BASE,
    color: 'var(--amber)',
    background: 'rgba(212,148,58,0.1)',
    border: '1px solid var(--border)',
  }
}

export const TAG_LABELS: Record<Tag, string> = {
  direct: 'direct',
  'supply-lock': 'supply lock',
  indirect: 'indirect',
  infrastructure: 'infrastructure',
  theoretical: 'theoretical',
}

export const COLLECTION_LABELS: Record<RepoCollectionId, string> = {
  'cv-related': 'CV',
  'clawd-gated': 'CLAWD gate',
}

export const LIFECYCLE_DISPLAY: Record<RepoLifecycle, string> = {
  shipping: 'Shipping',
  stable: 'Stable',
  done: 'Done ✅',
}

/** Commit count uses typography weight, not green gradient. */
export function commitCountColor(count: number | null): string {
  if (count === null || count === 0) return 'var(--text-muted)'
  return 'var(--text-primary)'
}
