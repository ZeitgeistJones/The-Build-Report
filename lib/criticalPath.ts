import type { Tag } from './scores'

/** Minimum pct for critical-path repos unless explicitly flagged otherwise (C- = 70). */
export const CRITICAL_PATH_FLOOR_PCT = 70

export type CriticalPathRole =
  | 'critical-shipping-infra'
  | 'builder-tool'
  | 'governance'
  | 'marketplace'
  | 'supply-integrity'

export interface CriticalPathEntry {
  tag: Tag
  role: CriticalPathRole
  /** Floor display grades at C when functioning as designed. */
  floorAtC: boolean
  roleBadge: string
}

/** Locked tags — override LLM-inferred tags for critical-path repos. */
export const CRITICAL_PATH_REPOS: Record<string, CriticalPathEntry> = {
  'nerve-cord': {
    tag: 'infrastructure',
    role: 'critical-shipping-infra',
    floorAtC: true,
    roleBadge: 'Critical shipping infra',
  },
  'clawd-harness': {
    tag: 'infrastructure',
    role: 'critical-shipping-infra',
    floorAtC: true,
    roleBadge: 'Critical shipping infra',
  },
  'dead-simple-agent': {
    tag: 'infrastructure',
    role: 'critical-shipping-infra',
    floorAtC: true,
    roleBadge: 'Critical shipping infra',
  },
  'clawd-containers': {
    tag: 'infrastructure',
    role: 'critical-shipping-infra',
    floorAtC: true,
    roleBadge: 'Critical shipping infra',
  },
  ethskills: {
    tag: 'infrastructure',
    role: 'builder-tool',
    floorAtC: true,
    roleBadge: 'Builder tool',
  },
  'leftclaw-services': {
    tag: 'direct',
    role: 'marketplace',
    floorAtC: true,
    roleBadge: 'Marketplace infra',
  },
  clawdviction: {
    tag: 'supply-lock',
    role: 'governance',
    floorAtC: true,
    roleBadge: 'Governance',
  },
  'clawd-vesting': {
    tag: 'supply-lock',
    role: 'supply-integrity',
    floorAtC: true,
    roleBadge: 'Supply lock',
  },
}

/** Completed contracts — quiet = success, not dormant. */
export const DONE_REPOS = new Set<string>(['clawd-vesting'])

export function getLockedTag(slug: string): Tag | null {
  return CRITICAL_PATH_REPOS[slug]?.tag ?? null
}

export function getEffectiveTag(repo: { githubSlug: string; tag: Tag }): Tag {
  return getLockedTag(repo.githubSlug) ?? repo.tag
}

export function isCriticalPath(slug: string): boolean {
  return slug in CRITICAL_PATH_REPOS
}

export function shouldFloorAtC(slug: string): boolean {
  return CRITICAL_PATH_REPOS[slug]?.floorAtC ?? false
}

export function getCriticalPathRole(slug: string): CriticalPathEntry | null {
  return CRITICAL_PATH_REPOS[slug] ?? null
}

export function isDoneRepo(slug: string): boolean {
  return DONE_REPOS.has(slug)
}
