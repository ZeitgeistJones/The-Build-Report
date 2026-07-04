'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { Repo, Tag, Confidence } from '@/lib/scores'
import {
  getEffectiveTag,
  getShippingLeverage,
  getTokenMechanicForDisplay,
  showsEconomicNa,
} from '@/lib/economicGrade'
import { getCriticalPathRole } from '@/lib/criticalPath'
import {
  computeRepoLifecycle,
  LIFECYCLE_LABELS,
  LIFECYCLE_STYLES,
  lifecycleHint,
} from '@/lib/repoLifecycle'
import { timeAgo } from '@/lib/github'
import { gradeColor } from '@/lib/gradeLetters'
import { isUnscoredRecent } from '@/lib/recentRepos'
import { isAutoInferredNote } from '@/lib/repoFilters'
import { getScoringStatus } from '@/lib/scoringStatus'
import GateBlur from '@/components/wallet/GateBlur'
import GateOverlay from '@/components/wallet/GateOverlay'
import { useClawdAccess } from '@/components/wallet/ClawdAccessContext'
import RepoScoreButton from '@/components/RepoScoreButton'
import { RepoWindowToggle } from '@/components/GradePeriodContext'
import { periodKeyLabel, repoCommitsForPeriodKey, type Period } from '@/lib/grades'
import RubricCriterionRow from '@/components/RubricCriterionRow'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'
import { type RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import InfoTooltip from '@/components/InfoTooltip'
import ScoreTypeBadge from '@/components/ScoreTypeBadge'
import {
  CONFIDENCE_LABEL,
  formatBaselineDate,
  formatScoredDateLabel,
  getConfidenceTooltip,
  isLaunchBaseline,
  looksLikeBaselineDate,
  RESCORE_SUMMARY_NOTE,
} from '@/lib/scoringCopy'
import { integritySectionFraming } from '@/lib/cardFraming'
import { formatScoringContextLabel, scoringContextTooltip } from '@/lib/scoringContext'

const TAG_STYLES: Record<Tag, { color: string; bg: string; label: string }> = {
  'direct': { color: '#5cb87a', bg: 'rgba(92,184,122,0.12)', label: 'direct' },
  'supply-lock': { color: '#5b9bd5', bg: 'rgba(91,155,213,0.12)', label: 'supply lock' },
  'indirect': { color: '#a07cd5', bg: 'rgba(160,124,213,0.12)', label: 'indirect' },
  'infrastructure': { color: '#7a7670', bg: 'rgba(122,118,112,0.12)', label: 'infrastructure' },
  'theoretical': { color: '#d4943a', bg: 'rgba(212,148,58,0.12)', label: 'theoretical' },
}

const TAG_BORDER_COLORS: Partial<Record<Tag, string>> = {
  direct: '#c8f060',
  'supply-lock': '#4ade80',
  indirect: '#60a5fa',
  infrastructure: '#6b7280',
  theoretical: '#a78bfa',
}

type Density = 'compact' | 'comfortable'
type ActivityScope = 'active' | 'all'
type RepoSort = 'recent' | 'commits' | 'grade'

const DENSITY_STYLES = {
  compact: { cardPadding: '14px 16px', name: 15, preview: 12, lastPushed: 11, gradeLetter: 20 },
  comfortable: { cardPadding: '18px 16px', name: 15, preview: 12, lastPushed: 11, gradeLetter: 22 },
} as const

const META_MUTED = '#5e5a55'
const STALE_AMBER = '#f59e0b'
const STALE_RED = '#ef4444'
const MS_PER_DAY = 24 * 60 * 60 * 1000
const GITHUB_COMMITS_CAP = 100

type ScoreAgeDisplay =
  | { kind: 'hidden' }
  | { kind: 'baseline'; label: string }
  | { kind: 'auto_count'; count: number; capped: boolean }
  | { kind: 'auto_age'; days: number }

function truncate120(text: string): string {
  return text.length > 120 ? `${text.slice(0, 119)}…` : text
}

function twoSentencesMax(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const firstPeriod = trimmed.indexOf('.')
  if (firstPeriod === -1) return trimmed

  const secondPeriod = trimmed.indexOf('.', firstPeriod + 1)
  if (secondPeriod === -1) {
    return trimmed.slice(0, firstPeriod + 1).trim()
  }

  const throughSecond = trimmed.slice(0, secondPeriod + 1).trim()
  const hasMore = trimmed.slice(secondPeriod + 1).trim().length > 0
  return hasMore ? `${throughSecond}…` : throughSecond
}

function formatPreviewLine(
  description: string | null | undefined,
  verdict: string | undefined,
  pending: boolean,
): string | null {
  const gh = description?.trim()
  if (gh) {
    const preview = truncate120(twoSentencesMax(gh))
    return preview || null
  }
  if (pending || !verdict?.trim()) return null
  const preview = truncate120(twoSentencesMax(verdict.trim()))
  return preview || null
}

function PillButton({
  active,
  onClick,
  children,
  isMobile,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  isMobile: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '12px',
        padding: isMobile ? '8px 14px' : '4px 11px',
        minHeight: isMobile ? MIN_TAP : undefined,
        borderRadius: '99px',
        border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        transition: 'all 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

function ConfidenceLabel({ confidence, isBaseline }: { confidence: Confidence; isBaseline: boolean }) {
  const label = CONFIDENCE_LABEL[confidence]
  const tooltip = getConfidenceTooltip(isBaseline)

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span>{label}</span>
      <InfoTooltip
        content={tooltip}
        ariaLabel={`About ${label.toLowerCase()}`}
      />
    </div>
  )
}

function rubricSectionGridStyle(
  section: 'sl' | 'tm' | 'bi',
  hasSL: boolean,
  hasTM: boolean,
  isMobile: boolean,
): React.CSSProperties | undefined {
  if (isMobile) return undefined
  if (hasSL && hasTM) {
    if (section === 'bi') return { gridColumn: '1 / -1' }
    return undefined
  }
  if (section === 'bi' && (hasSL || hasTM)) return { gridColumn: 2 }
  if ((section === 'sl' || section === 'tm') && (hasSL || hasTM)) return { gridColumn: 1 }
  return undefined
}

function RubricSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
      {children}
    </div>
  )
}

function VerdictBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > 220

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
      <p
        className={!expanded && long ? 'verdict-clamp' : undefined}
        style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}
      >
        {text}
      </p>
      {long && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{ marginTop: '6px', fontSize: '11px', color: 'var(--accent)', padding: 0 }}
        >
          Read full verdict
        </button>
      )}
    </div>
  )
}

function RescoreSummaryBlock({ meta }: { meta: RescoreSummaryRecord }) {
  const rescoreDate = formatScoredDateLabel(meta.rescoreAt)
  const oldDate = formatScoredDateLabel(meta.oldScoredAt)
  const fromBaseline = looksLikeBaselineDate(meta.oldScoredAt)

  return (
    <div style={{
      marginBottom: '14px',
      padding: '10px 12px',
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      fontSize: '12px',
      color: 'var(--text-secondary)',
      lineHeight: 1.55,
    }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--accent)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: fromBaseline ? '4px' : '8px',
      }}>
        Last rescore · {rescoreDate}
      </div>
      {fromBaseline && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          {RESCORE_SUMMARY_NOTE}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: meta.summary ? '8px' : 0, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Economic: </span>
          {meta.oldTokenMechanic ?? 'N/A'} → {meta.newTokenMechanic ?? 'N/A'}
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Builder integrity: </span>
          {meta.oldBuilderIntegrity} → {meta.newBuilderIntegrity}
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Scored: </span>
          {oldDate} → {formatScoredDateLabel(meta.newScoredAt)}
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Commits (30d at rescore): </span>
          {meta.commits30dAtRescore.toLocaleString()}
        </div>
      </div>
      {meta.summary && (
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>What changed: </span>
          {meta.summary}
        </p>
      )}
    </div>
  )
}

function githubOrderIndex(slug: string, order: string[]): number {
  const idx = order.indexOf(slug)
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}

function repoRecentTimestamp(repo: RepoWithLive): number {
  const raw = repo.lastCommitAt ?? repo.pushedAt
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? 0 : t
}

function repoGradeSortKey(repo: RepoWithLive): number {
  if (isUnscoredRecent(repo)) return -1
  const bi = repo.builderIntegrity?.pct ?? 0
  if (showsEconomicNa(repo)) {
    const sl = getShippingLeverage(repo)?.pct
    return sl != null ? (bi + sl) / 2 : bi
  }
  const tm = getTokenMechanicForDisplay(repo)?.pct
  return tm != null ? (bi + tm) / 2 : bi
}

function repoCommitsForPeriod(repo: RepoWithLive, period: Period): number {
  return repoCommitsForPeriodKey(repo, period)
}

function parseScoredAt(scoredAt: string | null | undefined): Date | null {
  if (!scoredAt) return null
  const scored = new Date(scoredAt)
  return Number.isNaN(scored.getTime()) ? null : scored
}

function daysSinceScored(scoredAt: string | null | undefined): number | null {
  const scored = parseScoredAt(scoredAt)
  if (!scored) return null
  return (Date.now() - scored.getTime()) / MS_PER_DAY
}

function isLaunchBaselineRepo(repo: RepoWithLive): boolean {
  return isLaunchBaseline(repo.adminNote)
}

function getScoreAgeDisplay(repo: RepoWithLive, pending: boolean): ScoreAgeDisplay {
  if (pending || !repo.scoredAt) return { kind: 'hidden' }

  if (isLaunchBaselineRepo(repo)) {
    return { kind: 'baseline', label: formatBaselineDate(repo.scoredAt) }
  }

  const days = daysSinceScored(repo.scoredAt)
  if (days === null) return { kind: 'hidden' }

  if (days < 1) {
    return { kind: 'auto_count', count: 0, capped: false }
  }

  if (days <= 30) {
    const commits30d = repo.commits30d ?? 0
    return {
      kind: 'auto_count',
      count: commits30d,
      capped: commits30d >= GITHUB_COMMITS_CAP,
    }
  }

  return { kind: 'auto_age', days: Math.floor(days) }
}

function commitsSinceScoredColor(count: number): string {
  if (count > 50) return STALE_RED
  if (count > 20) return STALE_AMBER
  return META_MUTED
}

interface RepoWithLive extends Repo {
  description: string | null
  lastCommitAt: string | null
  pushedAt: string | null
  commits30d: number | null
  commits7d: number | null
  commits7_14: number | null
  commits30_60: number | null
}

export type { RepoWithLive }

interface Props {
  repos: RepoWithLive[]
  githubSlugOrder?: string[]
  initialRescoreSummaries?: Record<string, RescoreSummaryRecord>
}

export default function RepoList({ repos, githubSlugOrder = [], initialRescoreSummaries = {} }: Props) {
  const [activeFilter, setActiveFilter] = useState<Tag | 'all'>('all')
  const [activityScope, setActivityScope] = useState<ActivityScope>('active')
  const [sortBy, setSortBy] = useState<RepoSort>('recent')
  const [repoPeriod, setRepoPeriod] = useState<Period>('30d')
  const [density, setDensity] = useState<Density>('compact')
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set())
  const [repoItems, setRepoItems] = useState(repos)
  const [rescoreSummaries, setRescoreSummaries] = useState(initialRescoreSummaries)
  const { unlocked } = useClawdAccess()
  const isMobile = useIsMobile()
  const effectiveDensity = isMobile ? 'compact' : density
  const d = DENSITY_STYLES[effectiveDensity]

  useEffect(() => {
    setRepoItems(repos)
  }, [repos])

  function handleScored(updated: Repo, rescoreMeta?: RescoreSummaryRecord | null) {
    if (rescoreMeta) {
      setRescoreSummaries(prev => ({ ...prev, [updated.githubSlug]: rescoreMeta }))
    }
    setRepoItems(prev =>
      prev.map(r =>
        r.githubSlug === updated.githubSlug
          ? {
              ...r,
              ...updated,
              id: r.id,
              githubSlug: r.githubSlug,
              scoredAt: updated.scoredAt,
              adminNote: updated.adminNote,
              description: r.description,
              lastCommitAt: r.lastCommitAt,
              pushedAt: r.pushedAt,
              commits30d: r.commits30d,
              commits7d: r.commits7d,
              commits7_14: r.commits7_14,
              commits30_60: r.commits30_60,
            }
          : r,
      ),
    )
  }

  const filters: { key: Tag | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'direct', label: 'Direct' },
    { key: 'supply-lock', label: 'Supply lock' },
    { key: 'indirect', label: 'Indirect' },
    { key: 'infrastructure', label: 'Infrastructure' },
    { key: 'theoretical', label: 'Theoretical' },
  ]

  const tagFiltered = repoItems.filter(r => activeFilter === 'all' || r.tag === activeFilter)
  const activeInPeriod = tagFiltered.filter(r => repoCommitsForPeriodKey(r, repoPeriod) > 0)
  const filtered = (activityScope === 'active' ? activeInPeriod : tagFiltered)
    .sort((a, b) => {
      if (sortBy === 'grade') {
        const diff = repoGradeSortKey(b) - repoGradeSortKey(a)
        if (diff !== 0) return diff
        return a.name.localeCompare(b.name)
      }

      if (sortBy === 'commits') {
        const diff = repoCommitsForPeriodKey(b, repoPeriod) - repoCommitsForPeriodKey(a, repoPeriod)
        if (diff !== 0) return diff
        return repoRecentTimestamp(b) - repoRecentTimestamp(a)
      }

      const aRecent = repoRecentTimestamp(a)
      const bRecent = repoRecentTimestamp(b)
      if (aRecent !== bRecent) return bRecent - aRecent

      if (githubSlugOrder.length) {
        const aIdx = githubOrderIndex(a.githubSlug, githubSlugOrder)
        const bIdx = githubOrderIndex(b.githubSlug, githubSlugOrder)
        if (aIdx !== bIdx) return aIdx - bIdx
      }

      return a.name.localeCompare(b.name)
    })

  const repoCountLabel = activityScope === 'active'
    ? activeFilter === 'all'
      ? ` · ${filtered.length} active (${periodKeyLabel(repoPeriod)})`
      : ` · ${filtered.length} of ${activeInPeriod.length} active (${periodKeyLabel(repoPeriod)})`
    : activeFilter === 'all'
      ? ` · ${filtered.length} total`
      : ` · ${filtered.length} of ${tagFiltered.length}`

  function isAutoInferred(repo: RepoWithLive) {
    return isAutoInferredNote(repo.adminNote)
  }

  function toggleExpand(slug: string) {
    setExpandedSlugs(prev => {
      const next = new Set(prev)
      const wasExpanded = next.has(slug)
      if (wasExpanded) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const visibleRepos = unlocked ? filtered : filtered.slice(0, 3)
  const gatedRepos = unlocked ? [] : filtered.slice(3)

  function renderRepoCard(repo: RepoWithLive) {
    const isExpanded = expandedSlugs.has(repo.githubSlug)
    const rescoreMeta = rescoreSummaries[repo.githubSlug]
    const ts = TAG_STYLES[getEffectiveTag(repo)]
    const borderColor = TAG_BORDER_COLORS[getEffectiveTag(repo)]
    const auto = isAutoInferred(repo)
    const pending = isUnscoredRecent(repo)
    const previewLine = formatPreviewLine(repo.description, repo.verdict, pending)
    const periodCommits = repoCommitsForPeriod(repo, repoPeriod)
    const lifecycle = computeRepoLifecycle(repo, periodCommits)
    const commitSuffix = periodCommits > 0 ? ` · ${periodCommits} commits (${periodKeyLabel(repoPeriod)})` : ''
    const sinceScored = getScoreAgeDisplay(repo, pending)
    const criticalPath = getCriticalPathRole(repo.githubSlug)
    const lcStyle = LIFECYCLE_STYLES[lifecycle]
    const economicNa = showsEconomicNa(repo)
    const shippingLeverage = getShippingLeverage(repo)
    const tokenMechanic = getTokenMechanicForDisplay(repo)

    return (
      <div
        key={repo.githubSlug}
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          ...(borderColor ? { borderLeft: `3px solid ${borderColor}` } : {}),
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--card-elevated)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: d.cardPadding,
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <button
            type="button"
            onClick={() => {
              toggleExpand(repo.githubSlug)
            }}
            aria-expanded={isExpanded}
            style={{
              flex: 1,
              minWidth: 0,
              width: isMobile ? '100%' : undefined,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              flexDirection: isMobile ? 'column' : 'row',
              textAlign: 'left',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  fontWeight: 500,
                  color: ts.color,
                  background: ts.bg,
                }}>
                  {ts.label}
                </span>
                {pending && (
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '99px',
                    color: 'var(--amber)',
                    background: 'rgba(212,148,58,0.1)',
                    border: '1px solid var(--border)',
                    letterSpacing: '0.03em',
                  }}>
                    awaiting score
                  </span>
                )}
                {criticalPath && (
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '99px',
                    color: 'var(--accent)',
                    background: 'var(--accent-dim)',
                    border: '1px solid var(--accent-border)',
                    letterSpacing: '0.02em',
                  }}>
                    {criticalPath.roleBadge}
                  </span>
                )}
                {!pending && (
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '99px',
                    fontWeight: 500,
                    color: lcStyle.color,
                    background: lcStyle.bg,
                    letterSpacing: '0.02em',
                  }}>
                    {lifecycle === 'done' ? `${LIFECYCLE_LABELS.done} ✅` : LIFECYCLE_LABELS[lifecycle]}
                  </span>
                )}
                {!pending && repo.scoredAt && (
                  <ScoreTypeBadge adminNote={repo.adminNote} />
                )}
                {!pending && isAutoInferredNote(repo.adminNote) && (
                  <Link
                    href="/context"
                    title={scoringContextTooltip(repo.scoringContextVersion)}
                    style={{
                      fontSize: '10px',
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      textDecoration: 'none',
                      padding: '2px 7px',
                      borderRadius: '99px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                    }}
                  >
                    {formatScoringContextLabel(repo.scoringContextVersion)}
                  </Link>
                )}
              </div>

              <div style={{ fontSize: `${d.name}px`, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em', lineHeight: 1.35 }}>
                {repo.name}
              </div>

              {previewLine && (
                <div style={{
                  fontSize: `${d.preview}px`,
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                  overflow: 'hidden',
                  ...(isMobile
                    ? {
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                        whiteSpace: 'normal',
                      }
                    : {
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }),
                }}>
                  {previewLine}
                </div>
              )}

              <div style={{
                fontSize: `${d.lastPushed}px`,
                color: META_MUTED,
                marginTop: '2px',
                ...(isMobile ? { lineHeight: 1.45 } : {}),
              }}>
                Last pushed {timeAgo(repo.pushedAt ?? repo.lastCommitAt)}{commitSuffix}
                {sinceScored.kind === 'baseline' && (
                  <>
                    {' · '}
                    <span style={{ color: META_MUTED }}>{sinceScored.label}</span>
                  </>
                )}
                {sinceScored.kind === 'auto_count' && (
                  <>
                    {' · '}
                    <span style={{ color: commitsSinceScoredColor(sinceScored.capped ? GITHUB_COMMITS_CAP : sinceScored.count) }}>
                      {sinceScored.capped ? '100+' : sinceScored.count} commits since scored
                    </span>
                  </>
                )}
                {sinceScored.kind === 'auto_age' && (
                  <>
                    {' · '}
                    <span style={{ color: META_MUTED }}>Scored {sinceScored.days} days ago</span>
                  </>
                )}
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              flexShrink: 0,
              ...(isMobile ? { width: '100%', justifyContent: 'space-between' } : {}),
            }}>
              {pending ? (
                <div style={{ textAlign: 'center', minWidth: '88px', paddingTop: '3px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>Pending</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>
                    not yet scored
                  </div>
                </div>
              ) : (
              <>
              {economicNa ? (
              <>
              <div style={{ textAlign: 'center', minWidth: '36px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', paddingTop: '3px' }}>N/A</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.25 }}>
                  economic<br />indirect
                </div>
              </div>

              <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />

              <div style={{ textAlign: 'center', minWidth: '36px' }}>
                {shippingLeverage ? (
                  <>
                    <div style={{ fontSize: `${d.gradeLetter}px`, fontWeight: 600, fontFamily: 'var(--font-mono)', color: gradeColor(shippingLeverage.letter) }}>
                      {shippingLeverage.letter}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>{shippingLeverage.pct}%</div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', paddingTop: '3px' }}>—</div>
                )}
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.25 }}>
                  shipping<br />leverage
                </div>
              </div>
              </>
              ) : (
              <div style={{ textAlign: 'center', minWidth: '40px' }}>
                {tokenMechanic ? (
                  <>
                    <div style={{ fontSize: `${d.gradeLetter}px`, fontWeight: 600, fontFamily: 'var(--font-mono)', color: gradeColor(tokenMechanic.letter) }}>
                      {tokenMechanic.letter}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>{tokenMechanic.pct}%</div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', paddingTop: '3px' }}>N/A</div>
                )}
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>token<br />mechanic</div>
              </div>
              )}

              <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />

              <div style={{ textAlign: 'center', minWidth: '40px' }}>
                <div style={{ fontSize: `${d.gradeLetter}px`, fontWeight: 600, fontFamily: 'var(--font-mono)', color: gradeColor(repo.builderIntegrity.letter) }}>
                  {repo.builderIntegrity.letter}
                </div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>{repo.builderIntegrity.pct}%</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>builder<br />integrity</div>
              </div>

              <div style={{ fontSize: '14px', color: 'var(--text-muted)', paddingTop: '3px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                ↓
              </div>
              </>
              )}
            </div>
          </button>

          <RepoScoreButton
            repoSlug={repo.githubSlug}
            scoringStatus={getScoringStatus(repo)}
            activity={{
              scoredAt: repo.scoredAt,
              lastCommitAt: repo.lastCommitAt,
              pushedAt: repo.pushedAt,
              commits7d: repo.commits7d,
              commits30d: repo.commits30d,
              adminNote: repo.adminNote,
              scoringContextVersion: repo.scoringContextVersion,
            }}
            onScored={handleScored}
          />
        </div>

        {isExpanded && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
            {pending && (
              <div style={{
                marginBottom: '10px',
                padding: '8px 10px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                lineHeight: 1.45,
              }}>
                This repo was recently pushed on GitHub and appears here for recency tracking. Run autoscore or Score to add rubric grades.
              </div>
            )}
            {!pending && (() => {
              const hasSL = !!shippingLeverage
              const hasTM = !!tokenMechanic
              const gridColumns = isMobile ? '1fr' : hasSL && hasTM ? '1fr 1fr' : hasSL || hasTM ? '1fr 1fr' : '1fr'

              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridColumns,
                    gap: '10px 14px',
                    marginBottom: '10px',
                  }}
                >
                  {hasSL && shippingLeverage && (
                    <div style={rubricSectionGridStyle('sl', hasSL, hasTM, isMobile)}>
                      <RubricSectionTitle>Shipping leverage</RubricSectionTitle>
                      {shippingLeverage.rubric.map((row, i) => (
                        <RubricCriterionRow
                          key={i}
                          label={row.label}
                          weight={row.weight}
                          level={row.level}
                          source={row.source}
                          isMobile={isMobile}
                        />
                      ))}
                      <p className="rubric-source-clamp" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0, lineHeight: 1.35 }}>
                        Indirect holder value — how much this repo multiplies the builder&apos;s ability to ship consumer apps that burn or lock CLAWD.
                      </p>
                    </div>
                  )}

                  {hasTM && tokenMechanic && (
                    <div style={rubricSectionGridStyle('tm', hasSL, hasTM, isMobile)}>
                      <RubricSectionTitle>Token mechanic</RubricSectionTitle>
                      {tokenMechanic.rubric.map((row, i) => (
                        <RubricCriterionRow
                          key={i}
                          label={row.label}
                          weight={row.weight}
                          level={row.level}
                          source={row.source}
                          isMobile={isMobile}
                        />
                      ))}
                    </div>
                  )}

                  {!hasSL && !hasTM && (
                    <div style={rubricSectionGridStyle('sl', false, false, isMobile)}>
                      <RubricSectionTitle>Economic score</RubricSectionTitle>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                        Not yet scored on token mechanic or shipping leverage.
                      </p>
                    </div>
                  )}

                  <div style={rubricSectionGridStyle('bi', hasSL, hasTM, isMobile)}>
                    <RubricSectionTitle>Builder integrity</RubricSectionTitle>
                    {integritySectionFraming(repo) && (
                      <p className="rubric-source-clamp" style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.35 }}>
                        {integritySectionFraming(repo)}
                      </p>
                    )}
                    {repo.builderIntegrity.rubric.map((row, i) => (
                      <RubricCriterionRow
                        key={i}
                        label={row.label}
                        weight={row.weight}
                        level={row.level}
                        source={row.source}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>

                  {lifecycleHint(lifecycle) && (
                    <p
                      className="rubric-source-clamp"
                      style={{
                        gridColumn: isMobile ? undefined : '1 / -1',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        margin: 0,
                        lineHeight: 1.35,
                        fontStyle: 'italic',
                      }}
                    >
                      {lifecycleHint(lifecycle)}
                    </p>
                  )}
                </div>
              )
            })()}

            {rescoreMeta && <RescoreSummaryBlock meta={rescoreMeta} />}

            <VerdictBlock text={repo.verdict} />

            {repo.adminNote && !auto && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}>
                <span style={{ color: 'var(--accent)', fontWeight: 500, marginRight: '6px' }}>Note:</span>
                {repo.adminNote}
              </div>
            )}

            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
              <ConfidenceLabel confidence={repo.confidence} isBaseline={isLaunchBaselineRepo(repo)} />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '10px' : 0,
      }}>
        <div style={{ fontSize: '11px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Repos{repoCountLabel}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          {filters.map(f => (
            <PillButton
              key={f.key}
              active={activeFilter === f.key}
              onClick={() => setActiveFilter(f.key)}
              isMobile={isMobile}
            >
              {f.label}
            </PillButton>
          ))}
          {!isMobile && (
            <>
              <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 4px' }} />
              <PillButton active={density === 'compact'} onClick={() => setDensity('compact')} isMobile={false}>
                Compact
              </PillButton>
              <PillButton active={density === 'comfortable'} onClick={() => setDensity('comfortable')} isMobile={false}>
                Comfortable
              </PillButton>
            </>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Show
        </span>
        <PillButton active={activityScope === 'active'} onClick={() => setActivityScope('active')} isMobile={isMobile}>
          Active in window
        </PillButton>
        <PillButton active={activityScope === 'all'} onClick={() => setActivityScope('all')} isMobile={isMobile}>
          All repos
        </PillButton>
        <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 4px' }} />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Sort
        </span>
        <PillButton active={sortBy === 'recent'} onClick={() => setSortBy('recent')} isMobile={isMobile}>
          Recent
        </PillButton>
        <PillButton active={sortBy === 'commits'} onClick={() => setSortBy('commits')} isMobile={isMobile}>
          Commits
        </PillButton>
        <PillButton active={sortBy === 'grade'} onClick={() => setSortBy('grade')} isMobile={isMobile}>
          Grades
        </PillButton>
        <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 4px' }} />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Window
        </span>
        <RepoWindowToggle period={repoPeriod} onChange={setRepoPeriod} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visibleRepos.map(repo => renderRepoCard(repo))}
        {gatedRepos.length > 0 && (
          <div style={{ position: 'relative' }}>
            <GateBlur locked>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {gatedRepos.map(repo => renderRepoCard(repo))}
              </div>
            </GateBlur>
            <GateOverlay />
          </div>
        )}
      </div>
    </div>
  )
}
