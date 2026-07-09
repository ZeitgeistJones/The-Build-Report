'use client'

import { useState, useEffect, useRef, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Repo, Tag, Confidence } from '@/lib/scores'
import {
  getEffectiveTag,
  getShippingLeverage,
  getTokenMechanicForDisplay,
  showsEconomicNa,
} from '@/lib/economicGrade'
import { hasShippingLeverageTag } from '@/lib/rubrics/shippingLeverage'
import { getCriticalPathRole } from '@/lib/criticalPath'
import {
  computeRepoLifecycle,
  lifecycleHint,
} from '@/lib/repoLifecycle'
import { isCreatedInPeriod, isTimestampInPeriod, timeAgo } from '@/lib/github'
import { gradeColor } from '@/lib/gradeLetters'
import { isUnscoredRecent } from '@/lib/recentRepos'
import { isAutoInferredNote } from '@/lib/repoFilters'
import { getScoringStatus } from '@/lib/scoringStatus'
import GateBlur from '@/components/wallet/GateBlur'
import GateOverlay from '@/components/wallet/GateOverlay'
import { useClawdAccess } from '@/components/wallet/ClawdAccessContext'
import { useNormieMode } from '@/components/NormieModeProvider'
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
  formatRescoreOldDateLabel,
  formatScoredDateLabel,
  getConfidenceTooltip,
  isLaunchBaseline,
  looksLikeBaselineDate,
  RESCORE_NOT_SCORED_LABEL,
  RESCORE_SUMMARY_NOTE,
} from '@/lib/scoringCopy'
import { diffRubricRows, rowDeltaByLabel } from '@/lib/rescoreDeltas'
import { integritySectionFraming, economicSectionFraming, economicLensLabel } from '@/lib/cardFraming'
import { formatScoringContextLabel, scoringContextTooltip } from '@/lib/scoringContext'
import { commitsSinceScoreLabel, countCommitsSinceScore, repoNeedsRescore, repoNeedsRescoreSortKey } from '@/lib/commitsSinceScore'
import RepoBadge from '@/components/RepoBadge'
import RepoCardLegend from '@/components/RepoCardLegend'
import CommunityContextSection from '@/components/CommunityContextSection'
import type { RepoContextSummary } from '@/lib/communityContextTypes'
import { BI_WEIGHTS_TOOLTIP_SHORT } from '@/lib/rubrics/builderIntegrity'
import {
  REPO_COLLECTIONS,
  collectionIdsForSlug,
  type RepoCollectionId,
} from '@/lib/repoCollections'
import {
  AWAITING_SCORE_TOOLTIP,
  BUILDER_STANDARDS_COLUMN_TOOLTIP,
  criticalPathTooltip,
  HOLDER_ECONOMICS_COLUMN_TOOLTIP,
  LIFECYCLE_TOOLTIPS,
  commitsColumnTooltip,
  formatPeriodCommitDisplay,
  REPO_FILTER_TOOLTIPS,
  REPO_SCOPE_TOOLTIPS,
  REPO_SORT_TOOLTIPS,
  TAG_TOOLTIPS,
} from '@/lib/badgeTooltips'
import {
  accentBadgeStyle,
  COLLECTION_LABELS,
  commitCountColor,
  LIFECYCLE_DISPLAY,
  neutralBadgeStyle,
  TAG_LABELS,
  warningBadgeStyle,
} from '@/lib/repoVisualStyles'

type ActivityScope = 'active' | 'all'
type RepoSort = 'recent' | 'commits' | 'needs-rescore' | 'grade'
export type RepoFilter =
  | 'all'
  | 'needs-rescore'
  | 'recently-rescored'
  | 'new-arrivals'
  | 'holder-economics'
  | 'shipping-leverage'
  | 'clawd-cv-perks'
  | 'community-context'
  | Tag

const CARD = { cardPadding: '14px 16px', name: 15, preview: 12, lastPushed: 11, gradeLetter: 20, metricLabel: 9, pctLabel: 10 } as const
const METRIC_COL_WIDTH = { holder: 52, builder: 44, commits: 38 } as const

function commitsColumnLabel(metricLabelPx: number) {
  return (
    <div
      style={{
        fontSize: `${metricLabelPx}px`,
        color: 'var(--text-muted)',
        marginTop: '2px',
        lineHeight: 1.25,
      }}
    >
      commits
    </div>
  )
}

function metricColStyle(isMobile: boolean, width: number) {
  return isMobile
    ? { textAlign: 'center' as const }
    : { textAlign: 'center' as const, width, flexShrink: 0, paddingTop: '3px' }
}

function gradeLetterStyle(gradeLetter: number, color: string) {
  return {
    fontSize: `${gradeLetter}px`,
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color,
    lineHeight: 1,
    minHeight: `${gradeLetter}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
}

const META_MUTED = '#5e5a55'
const STALE_AMBER = '#f59e0b'
const STALE_RED = '#ef4444'
const MS_PER_DAY = 24 * 60 * 60 * 1000
const GITHUB_COMMITS_CAP = 100

const PERIOD_WINDOW_LABEL: Record<Period, string> = {
  '24h': 'last 24 hours',
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '60d': 'last 60 days',
}

function MetricDivider({ show }: { show: boolean }) {
  if (!show) return null
  return <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />
}

function cardLayout(isMobile: boolean) {
  if (!isMobile) return CARD
  return { ...CARD, gradeLetter: 16, metricLabel: 8, pctLabel: 9 }
}

type ScoreAgeDisplay =
  | { kind: 'hidden' }
  | { kind: 'baseline'; label: string }
  | { kind: 'auto_count'; count: number; capped: boolean; label: string }
  | { kind: 'auto_new' }
  | { kind: 'auto_age'; days: number }

function repoRescoredAt(
  repo: RepoWithLive,
  rescoreSummaries: Record<string, RescoreSummaryRecord>,
): string | null {
  const fromSummary = rescoreSummaries[repo.githubSlug]?.rescoreAt
  if (fromSummary) return fromSummary
  // Live AI scores without a summary still count; skip launch baselines / unscored cards.
  if (isUnscoredRecent(repo) || isLaunchBaseline(repo.adminNote) || looksLikeBaselineDate(repo.scoredAt)) {
    return null
  }
  return repo.scoredAt ?? null
}

function repoMatchesFilter(
  repo: RepoWithLive,
  filter: RepoFilter,
  collectionSets: Record<RepoCollectionId, Set<string>>,
  contextSummary: Record<string, RepoContextSummary>,
  pinnedNeedsRescoreSlugs: readonly string[] = [],
  period: Period = '24h',
  rescoreSummaries: Record<string, RescoreSummaryRecord> = {},
): boolean {
  const slug = repo.githubSlug
  const tag = getEffectiveTag(repo)
  if (filter === 'all') return true
  if (filter === 'needs-rescore') {
    if (pinnedNeedsRescoreSlugs.includes(slug)) return true
    return repoNeedsRescore(repo.scoredAt, repo.commitTimestamps, {
      lastCommitAt: repo.lastCommitAt,
      pushedAt: repo.pushedAt,
    })
  }
  if (filter === 'recently-rescored') {
    return isTimestampInPeriod(repoRescoredAt(repo, rescoreSummaries), period)
  }
  if (filter === 'new-arrivals') return isCreatedInPeriod(repo.createdAt, period)
  if (filter === 'holder-economics') return tag === 'direct' || tag === 'supply-lock'
  if (filter === 'shipping-leverage') return hasShippingLeverageTag(tag)
  if (filter === 'clawd-cv-perks') {
    return collectionSets['cv-related'].has(slug) || collectionSets['clawd-gated'].has(slug)
  }
  if (filter === 'community-context') return Boolean(contextSummary[slug])
  return tag === filter
}

function buildCollectionSets(
  collections: Record<RepoCollectionId, string[]> | undefined,
): Record<RepoCollectionId, Set<string>> {
  return {
    'cv-related': new Set(collections?.['cv-related'] ?? []),
    'clawd-gated': new Set(collections?.['clawd-gated'] ?? []),
  }
}

function pickRepoBlurb(
  description: string | null | undefined,
  verdict: string | undefined,
  pending: boolean,
): { text: string | null; source: 'description' | 'verdict' | null } {
  const gh = description?.trim()
  if (gh) return { text: gh, source: 'description' }
  if (pending || !verdict?.trim()) return { text: null, source: null }
  return { text: verdict.trim(), source: 'verdict' }
}

const PILL_TOOLTIP_DELAY_MS = 400

function PillButton({
  active,
  onClick,
  children,
  isMobile,
  tooltip,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  isMobile: boolean
  tooltip?: string
}) {
  const [showTip, setShowTip] = useState(false)
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  function handleMouseEnter() {
    if (!tooltip || isMobile) return
    clearHoverTimer()
    hoverTimerRef.current = setTimeout(() => setShowTip(true), PILL_TOOLTIP_DELAY_MS)
  }

  function handleMouseLeave() {
    clearHoverTimer()
    setShowTip(false)
  }

  useLayoutEffect(() => {
    if (!showTip || !btnRef.current) {
      setTipPos(null)
      return
    }
    const rect = btnRef.current.getBoundingClientRect()
    const panelWidth = 260
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
    setTipPos({ top: rect.bottom + 6, left })
  }, [showTip])

  useEffect(() => () => clearHoverTimer(), [])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={tooltip ? `${String(children)}. ${tooltip}` : undefined}
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
      {showTip && tipPos && tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            top: tipPos.top,
            left: tipPos.left,
            zIndex: 9999,
            pointerEvents: 'none',
            width: 260,
            background: 'var(--surface-3)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            textAlign: 'left',
            boxShadow: 'var(--card-elevated)',
          }}
        >
          {tooltip}
        </div>,
        document.body,
      )}
    </>
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

function RubricSectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
      <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {children}
      </div>
      {hint && (
        <InfoTooltip
          content={hint}
          ariaLabel="Builder standards weight explanation"
          icon="question"
          width={240}
          compact
        />
      )}
    </div>
  )
}

function formatRescoreOldGrade(label: string | null | undefined): string {
  if (!label || label === '—') return RESCORE_NOT_SCORED_LABEL
  return label
}

function RescoreSummaryBlock({ meta }: { meta: RescoreSummaryRecord }) {
  const rescoreDate = formatScoredDateLabel(meta.rescoreAt)
  const oldDate = formatRescoreOldDateLabel(meta.oldScoredAt)
  const fromBaseline = looksLikeBaselineDate(meta.oldScoredAt)
  const oldEconomic = meta.oldTokenMechanic ?? RESCORE_NOT_SCORED_LABEL
  const newEconomic = meta.newTokenMechanic ?? 'N/A'
  const showWhatChanged = meta.deltaHeader || meta.summary

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: showWhatChanged ? '8px' : 0, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Economic: </span>
          {oldEconomic} → {newEconomic}
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Builder standards: </span>
          {formatRescoreOldGrade(meta.oldBuilderIntegrity)} → {meta.newBuilderIntegrity}
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
      {showWhatChanged && (
        <div style={{ margin: 0, color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>What changed: </span>
          {meta.deltaHeader && (
            <span style={{ display: 'block', marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
              {meta.deltaHeader}
            </span>
          )}
          {meta.summary && (
            <span style={{ display: 'block', marginTop: meta.deltaHeader ? '6px' : '4px' }}>
              {meta.summary}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function githubOrderIndex(slug: string, order: string[]): number {
  const idx = order.indexOf(slug)
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}

function repoActivityFallback(repo: RepoWithLive) {
  return { lastCommitAt: repo.lastCommitAt, pushedAt: repo.pushedAt }
}

function repoNeedsRescoreKey(repo: RepoWithLive): number {
  return repoNeedsRescoreSortKey(repo.scoredAt, repo.commitTimestamps, repoActivityFallback(repo))
}

function repoRecentTimestamp(repo: RepoWithLive): number {
  const raw = repo.lastCommitAt ?? repo.pushedAt
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? 0 : t
}

function repoCreatedTimestamp(repo: RepoWithLive): number {
  if (!repo.createdAt) return 0
  const t = new Date(repo.createdAt).getTime()
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

function repoCommitsForPeriod(repo: RepoWithLive, period: Period): number | null {
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

  const result = countCommitsSinceScore(
    repo.scoredAt,
    repo.commitTimestamps,
    { lastCommitAt: repo.lastCommitAt, pushedAt: repo.pushedAt },
  )

  const activityFallback = { lastCommitAt: repo.lastCommitAt, pushedAt: repo.pushedAt }
  const sinceLabel = commitsSinceScoreLabel(repo.scoredAt, repo.commitTimestamps, activityFallback)

  if (result.exact) {
    return { kind: 'auto_count', count: result.count, capped: result.capped, label: sinceLabel }
  }

  if (result.hasNew) {
    return { kind: 'auto_new' }
  }

  const days = daysSinceScored(repo.scoredAt)
  if (days !== null && days > 30) {
    return { kind: 'auto_age', days: Math.floor(days) }
  }

  return { kind: 'auto_count', count: 0, capped: false, label: sinceLabel }
}

function commitsSinceScoredColor(count: number): string {
  if (count > 50) return STALE_RED
  if (count > 20) return STALE_AMBER
  return META_MUTED
}

interface RepoWithLive extends Repo {
  description: string | null
  createdAt: string | null
  lastCommitAt: string | null
  pushedAt: string | null
  commitsScanned?: boolean | null
  commits24h: number | null
  commits30d: number | null
  commits7d: number | null
  commits7_14: number | null
  commits30_60: number | null
  commitTimestamps: string[] | null
  commitsCapped?: boolean | null
}

export type { RepoWithLive }

interface Props {
  repos: RepoWithLive[]
  githubSlugOrder?: string[]
  initialRescoreSummaries?: Record<string, RescoreSummaryRecord>
  repoCollections?: Record<RepoCollectionId, string[]>
  communityContextEnabled?: boolean
  contextSummary?: Record<string, RepoContextSummary>
  filterControl?: { filter: RepoFilter; expandSlugs: string[] } | null
}

export default function RepoList({
  repos,
  githubSlugOrder = [],
  initialRescoreSummaries = {},
  repoCollections,
  communityContextEnabled = false,
  contextSummary = {},
  filterControl = null,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<RepoFilter>('all')
  const [activityScope, setActivityScope] = useState<ActivityScope>('active')
  const [sortBy, setSortBy] = useState<RepoSort>('commits')
  const [repoPeriod, setRepoPeriod] = useState<Period>('24h')
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set())
  const [repoItems, setRepoItems] = useState(repos)
  const [rescoreSummaries, setRescoreSummaries] = useState(initialRescoreSummaries)
  const [pinnedNeedsRescoreSlugs, setPinnedNeedsRescoreSlugs] = useState<string[]>([])
  const { unlocked } = useClawdAccess()
  const { normie } = useNormieMode()
  const isMobile = useIsMobile()
  const d = cardLayout(isMobile)
  const collectionSets = buildCollectionSets(repoCollections)

  useEffect(() => {
    if (!filterControl) return
    setActiveFilter(filterControl.filter)
    if (filterControl.expandSlugs.length) {
      setExpandedSlugs(new Set(filterControl.expandSlugs))
    }
  }, [filterControl])

  useEffect(() => {
    setRepoItems(prev => {
      const prevBySlug = new Map(prev.map(r => [r.githubSlug, r]))
      return repos.map(r => {
        const local = prevBySlug.get(r.githubSlug)
        if (!local?.scoredAt) return r

        const localScored = Date.parse(local.scoredAt)
        const serverScored = r.scoredAt ? Date.parse(r.scoredAt) : 0
        if (!Number.isFinite(localScored) || localScored <= serverScored) return r

        return {
          ...r,
          ...local,
          id: r.id,
          githubSlug: r.githubSlug,
        }
      })
    })
  }, [repos])

  function handleScored(updated: Repo, rescoreMeta?: RescoreSummaryRecord | null) {
    if (rescoreMeta) {
      setRescoreSummaries(prev => ({ ...prev, [updated.githubSlug]: rescoreMeta }))
    }
    setPinnedNeedsRescoreSlugs(prev => {
      if (activeFilter !== 'needs-rescore') return prev
      return [updated.githubSlug, ...prev.filter(slug => slug !== updated.githubSlug)]
    })
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
              createdAt: r.createdAt,
              lastCommitAt: r.lastCommitAt,
              pushedAt: r.pushedAt,
              commits24h: r.commits24h,
              commits30d: r.commits30d,
              commits7d: r.commits7d,
              commits7_14: r.commits7_14,
              commits30_60: r.commits30_60,
              commitTimestamps: r.commitTimestamps,
              commitsCapped: r.commitsCapped,
            }
          : r,
      ),
    )
  }

  const filters: { key: RepoFilter; label: string; tooltip?: string }[] = [
    { key: 'all', label: 'All', tooltip: REPO_FILTER_TOOLTIPS.all },
    { key: 'needs-rescore', label: 'Needs rescore', tooltip: REPO_FILTER_TOOLTIPS['needs-rescore'] },
    { key: 'recently-rescored', label: 'Recently rescored', tooltip: REPO_FILTER_TOOLTIPS['recently-rescored'] },
    { key: 'new-arrivals', label: 'New arrivals', tooltip: REPO_FILTER_TOOLTIPS['new-arrivals'] },
    { key: 'clawd-cv-perks', label: 'Clawd/CV perks', tooltip: REPO_FILTER_TOOLTIPS['clawd-cv-perks'] },
    { key: 'holder-economics', label: 'Holder economics', tooltip: REPO_FILTER_TOOLTIPS['holder-economics'] },
    { key: 'shipping-leverage', label: 'Shipping leverage', tooltip: REPO_FILTER_TOOLTIPS['shipping-leverage'] },
    { key: 'direct', label: 'Direct burn', tooltip: TAG_TOOLTIPS.direct },
    { key: 'supply-lock', label: 'Supply lock', tooltip: TAG_TOOLTIPS['supply-lock'] },
    { key: 'indirect', label: 'Indirect', tooltip: TAG_TOOLTIPS.indirect },
    { key: 'infrastructure', label: 'Infrastructure', tooltip: TAG_TOOLTIPS.infrastructure },
    { key: 'theoretical', label: 'Theoretical', tooltip: TAG_TOOLTIPS.theoretical },
  ]

  const contextRepoCount = Object.keys(contextSummary).length
  if (communityContextEnabled) {
    // After New arrivals (all / needs-rescore / recently-rescored / new-arrivals).
    filters.splice(4, 0, {
      key: 'community-context',
      label: contextRepoCount > 0 ? `Community context (${contextRepoCount})` : 'Community context',
      tooltip: REPO_FILTER_TOOLTIPS['community-context'],
    })
  }

  const tagFiltered = repoItems.filter(r =>
    repoMatchesFilter(
      r,
      activeFilter,
      collectionSets,
      contextSummary,
      pinnedNeedsRescoreSlugs,
      repoPeriod,
      rescoreSummaries,
    ),
  )
  const activeInPeriod = tagFiltered.filter(r => {
    const c = repoCommitsForPeriodKey(r, repoPeriod)
    return c != null && c > 0
  })
  const skipActiveScope =
    activeFilter === 'needs-rescore' ||
    activeFilter === 'new-arrivals' ||
    activeFilter === 'recently-rescored'
  const filtered = (activityScope === 'active' && !skipActiveScope ? activeInPeriod : tagFiltered)
    .sort((a, b) => {
      if (activeFilter === 'needs-rescore' && pinnedNeedsRescoreSlugs.length) {
        const aPinned = pinnedNeedsRescoreSlugs.indexOf(a.githubSlug)
        const bPinned = pinnedNeedsRescoreSlugs.indexOf(b.githubSlug)
        if (aPinned !== -1 || bPinned !== -1) {
          if (aPinned === -1) return 1
          if (bPinned === -1) return -1
          return aPinned - bPinned
        }
      }

      if (activeFilter === 'recently-rescored') {
        const aAt = Date.parse(repoRescoredAt(a, rescoreSummaries) ?? '') || 0
        const bAt = Date.parse(repoRescoredAt(b, rescoreSummaries) ?? '') || 0
        if (aAt !== bAt) return bAt - aAt
      }

      if (activeFilter === 'new-arrivals') {
        const createdDiff = repoCreatedTimestamp(b) - repoCreatedTimestamp(a)
        if (createdDiff !== 0) return createdDiff
      }

      if (activeFilter === 'community-context') {
        const aTalk = contextSummary[a.githubSlug]?.lastActivityAt ?? ''
        const bTalk = contextSummary[b.githubSlug]?.lastActivityAt ?? ''
        const talkDiff = bTalk.localeCompare(aTalk)
        if (talkDiff !== 0) return talkDiff
      }

      if (sortBy === 'grade') {
        const diff = repoGradeSortKey(b) - repoGradeSortKey(a)
        if (diff !== 0) return diff
        return a.name.localeCompare(b.name)
      }

      if (sortBy === 'commits') {
        const bCommits = repoCommitsForPeriodKey(b, repoPeriod) ?? -1
        const aCommits = repoCommitsForPeriodKey(a, repoPeriod) ?? -1
        const diff = bCommits - aCommits
        if (diff !== 0) return diff
        return repoRecentTimestamp(b) - repoRecentTimestamp(a)
      }

      if (sortBy === 'needs-rescore') {
        const diff = repoNeedsRescoreKey(b) - repoNeedsRescoreKey(a)
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

  const repoCountLabel = activeFilter === 'needs-rescore'
    ? ` · ${filtered.length} need rescore`
    : activeFilter === 'recently-rescored'
      ? ` · ${filtered.length} rescored (${periodKeyLabel(repoPeriod)})`
    : activeFilter === 'new-arrivals'
      ? ` · ${filtered.length} new arrival${filtered.length === 1 ? '' : 's'} (${periodKeyLabel(repoPeriod)})`
    : activityScope === 'active'
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
    const effectiveTag = getEffectiveTag(repo)
    const auto = isAutoInferred(repo)
    const pending = isUnscoredRecent(repo)
    const effectiveVerdict =
      normie && repo.normieVerdict?.trim() ? repo.normieVerdict : repo.verdict
    const blurbDescription =
      normie && repo.normieVerdict?.trim() ? null : repo.description
    const blurb = pickRepoBlurb(blurbDescription, effectiveVerdict, pending)
    const verdictText = effectiveVerdict?.trim() ?? ''
    const showSeparateVerdict =
      isExpanded &&
      blurb.source === 'description' &&
      verdictText.length > 0 &&
      verdictText !== blurb.text
    const periodCommits = repoCommitsForPeriod(repo, repoPeriod)
    const commitsHitCap = Boolean(
      periodCommits != null &&
        (repo.commitsCapped ?? ((repo.commitTimestamps?.length ?? 0) >= GITHUB_COMMITS_CAP)),
    )
    const periodCommitsCapped = commitsHitCap && (periodCommits ?? 0) >= GITHUB_COMMITS_CAP
    const periodCommitsLabel = formatPeriodCommitDisplay(periodCommits, commitsHitCap)
    const lifecycle = computeRepoLifecycle(repo, periodCommits ?? 0)
    const sinceScored = getScoreAgeDisplay(repo, pending)
    const criticalPath = getCriticalPathRole(repo.githubSlug)
    const shippingLeverage = getShippingLeverage(repo)
    const tokenMechanic = getTokenMechanicForDisplay(repo)
    const slRowDeltas = rescoreMeta?.oldRubrics
      ? rowDeltaByLabel(diffRubricRows(rescoreMeta.oldRubrics.shippingLeverage, shippingLeverage?.rubric ?? []))
      : null
    const tmRowDeltas = rescoreMeta?.oldRubrics
      ? rowDeltaByLabel(diffRubricRows(rescoreMeta.oldRubrics.tokenMechanic, tokenMechanic?.rubric ?? []))
      : null
    const biRowDeltas = rescoreMeta?.oldRubrics
      ? rowDeltaByLabel(diffRubricRows(rescoreMeta.oldRubrics.builderIntegrity, repo.builderIntegrity.rubric))
      : null
    const economicScore = shippingLeverage ?? tokenMechanic
    const collectionIds = collectionIdsForSlug(repo.githubSlug, {
      'cv-related': Array.from(collectionSets['cv-related']),
      'clawd-gated': Array.from(collectionSets['clawd-gated']),
    })

    return (
      <div
        key={repo.githubSlug}
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
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
            aria-label={isExpanded ? 'Collapse repo rubric details' : 'Expand repo rubric details'}
            style={{
              flex: 1,
              minWidth: 0,
              width: isMobile ? '100%' : undefined,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              textAlign: 'left',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                paddingTop: '2px',
                minWidth: '24px',
                color: 'var(--text-muted)',
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: '14px',
                  lineHeight: 1,
                  transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(180deg)' : 'none',
                }}
              >
                ↓
              </span>
              <span style={{ fontSize: '8px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                details
              </span>
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                flexDirection: isMobile ? 'column' : 'row',
              }}
            >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                <RepoBadge
                  tooltip={TAG_TOOLTIPS[effectiveTag]}
                  style={{ ...neutralBadgeStyle(), fontSize: '11px', padding: '2px 8px' }}
                >
                  {TAG_LABELS[effectiveTag]}
                </RepoBadge>
                {pending ? (
                  <RepoBadge tooltip={AWAITING_SCORE_TOOLTIP} style={warningBadgeStyle()}>
                    awaiting score
                  </RepoBadge>
                ) : (
                  <RepoBadge tooltip={LIFECYCLE_TOOLTIPS[lifecycle]} style={neutralBadgeStyle()}>
                    {LIFECYCLE_DISPLAY[lifecycle]}
                  </RepoBadge>
                )}
              </div>

              {(() => {
                const secondary: ReactNode[] = []
                if (criticalPath) {
                  secondary.push(
                    <RepoBadge
                      key="critical"
                      tooltip={criticalPathTooltip(criticalPath.roleBadge)}
                      style={accentBadgeStyle()}
                    >
                      {criticalPath.roleBadge}
                    </RepoBadge>,
                  )
                }
                collectionIds.forEach(id => {
                  const def = REPO_COLLECTIONS.find(c => c.id === id)
                  secondary.push(
                    <RepoBadge
                      key={id}
                      tooltip={def?.tooltip ?? COLLECTION_LABELS[id]}
                      style={neutralBadgeStyle()}
                    >
                      {COLLECTION_LABELS[id]}
                    </RepoBadge>,
                  )
                })
                if (communityContextEnabled && contextSummary[repo.githubSlug]) {
                  const ctx = contextSummary[repo.githubSlug]
                  const accepted = ctx.state === 'accepted'
                  secondary.push(
                    <Link
                      key="context"
                      href="/how-we-score#hw-score-community"
                      onClick={e => e.stopPropagation()}
                      style={{ textDecoration: 'none' }}
                    >
                      <RepoBadge
                        tooltip={
                          accepted
                            ? 'Holder context accepted — applied on the next rescore. Expand for details.'
                            : `Holder context gathering votes (${ctx.upvotes}/${ctx.needed} to accept). Expand to vote.`
                        }
                        style={accepted ? accentBadgeStyle() : warningBadgeStyle()}
                      >
                        {accepted ? 'context ✓' : `context ${ctx.upvotes}/${ctx.needed}`}
                      </RepoBadge>
                    </Link>,
                  )
                }
                if (!pending && repo.scoredAt) {
                  secondary.push(<ScoreTypeBadge key="score-type" adminNote={repo.adminNote} />)
                }
                if (!pending && isAutoInferredNote(repo.adminNote)) {
                  secondary.push(
                    <Link
                      key="scoring-ctx"
                      href="/how-we-score#context"
                      style={{ textDecoration: 'none' }}
                    >
                      <RepoBadge
                        tooltip={scoringContextTooltip(repo.scoringContextVersion)}
                        style={neutralBadgeStyle()}
                      >
                        {formatScoringContextLabel(repo.scoringContextVersion)}
                      </RepoBadge>
                    </Link>,
                  )
                }
                if (secondary.length === 0) return null
                return (
                  <div
                    style={{
                      display: 'flex',
                      gap: '5px',
                      marginBottom: '5px',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      opacity: 0.92,
                    }}
                  >
                    {secondary}
                  </div>
                )
              })()}

              <div style={{ fontSize: `${d.name}px`, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em', lineHeight: 1.35 }}>
                {repo.name}
              </div>

              {blurb.text && (
                <div
                  className={!isExpanded ? 'repo-preview-clamp' : undefined}
                  style={{
                    fontSize: `${d.preview}px`,
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                    lineHeight: 1.45,
                    whiteSpace: 'normal',
                  }}
                >
                  {blurb.text}
                </div>
              )}

              <div style={{
                fontSize: `${d.lastPushed}px`,
                color: META_MUTED,
                marginTop: '2px',
                ...(isMobile ? { lineHeight: 1.45 } : {}),
              }}>
                Last pushed {timeAgo(repo.pushedAt ?? repo.lastCommitAt)}
                {sinceScored.kind === 'baseline' && (
                  <>
                    {' · '}
                    <span style={{ color: META_MUTED }}>{sinceScored.label}</span>
                  </>
                )}
                {sinceScored.kind === 'auto_count' && (
                  <>
                    {' · '}
                    <span
                      style={{ color: commitsSinceScoredColor(sinceScored.capped ? GITHUB_COMMITS_CAP : sinceScored.count) }}
                      title={
                        sinceScored.count === 0 && periodCommits != null && periodCommits > 0
                          ? `${periodCommits} commit${periodCommits === 1 ? '' : 's'} in this window landed before the last score — only post-score commits count here.`
                          : undefined
                      }
                    >
                      {sinceScored.label}
                    </span>
                  </>
                )}
                {sinceScored.kind === 'auto_new' && (
                  <>
                    {' · '}
                    <span style={{ color: STALE_AMBER }}>New commits since scored</span>
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

            <div style={
              isMobile
                ? {
                    display: 'grid',
                    gridTemplateColumns: pending
                      ? 'repeat(2, minmax(0, 1fr))'
                      : 'repeat(3, minmax(0, 1fr))',
                    gap: '6px',
                    width: '100%',
                    alignItems: 'start',
                  }
                : {
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    flexShrink: 0,
                  }
            }>
              {pending ? (
                <>
                <div style={{ textAlign: 'center', minWidth: isMobile ? undefined : '88px', paddingTop: '3px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>Pending</div>
                  <div style={{ fontSize: `${d.metricLabel}px`, color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>
                    not yet scored
                  </div>
                </div>

                <MetricDivider show={!isMobile} />

                <RepoBadge
                  tooltip={commitsColumnTooltip(PERIOD_WINDOW_LABEL[repoPeriod], periodCommits, periodCommitsCapped)}
                  style={{ ...metricColStyle(isMobile, METRIC_COL_WIDTH.commits), display: 'block' }}
                >
                  <div style={gradeLetterStyle(d.gradeLetter, commitCountColor(periodCommits))}>
                    {periodCommitsLabel}
                  </div>
                  {commitsColumnLabel(d.metricLabel)}
                </RepoBadge>
                </>
              ) : (
              <>
              <RepoBadge
                tooltip={
                  showsEconomicNa(repo)
                    ? REPO_FILTER_TOOLTIPS['shipping-leverage']
                    : HOLDER_ECONOMICS_COLUMN_TOOLTIP
                }
                style={{ ...metricColStyle(isMobile, METRIC_COL_WIDTH.holder), display: 'block' }}
              >
                {economicScore ? (
                  <>
                    <div style={gradeLetterStyle(d.gradeLetter, gradeColor(economicScore.letter))}>
                      {economicScore.letter}
                    </div>
                    <div style={{ fontSize: `${d.pctLabel}px`, fontWeight: 600, color: 'var(--text-muted)' }}>{economicScore.pct}%</div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', paddingTop: '3px' }}>N/A</div>
                )}
                <div style={{ fontSize: `${d.metricLabel}px`, color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.25 }}>
                  {showsEconomicNa(repo) ? (
                    <>shipping<br />leverage</>
                  ) : (
                    <>holder<br />economics</>
                  )}
                </div>
              </RepoBadge>

              <MetricDivider show={!isMobile} />

              <RepoBadge
                tooltip={BUILDER_STANDARDS_COLUMN_TOOLTIP}
                style={{ ...metricColStyle(isMobile, METRIC_COL_WIDTH.builder), display: 'block' }}
              >
                <div style={gradeLetterStyle(d.gradeLetter, gradeColor(repo.builderIntegrity.letter))}>
                  {repo.builderIntegrity.letter}
                </div>
                <div style={{ fontSize: `${d.pctLabel}px`, fontWeight: 600, color: 'var(--text-muted)' }}>{repo.builderIntegrity.pct}%</div>
                <div style={{ fontSize: `${d.pctLabel}px`, color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>builder<br />standards</div>
              </RepoBadge>

              <MetricDivider show={!isMobile} />

              <RepoBadge
                tooltip={commitsColumnTooltip(PERIOD_WINDOW_LABEL[repoPeriod], periodCommits, periodCommitsCapped)}
                style={{ ...metricColStyle(isMobile, METRIC_COL_WIDTH.commits), display: 'block' }}
              >
                <div style={gradeLetterStyle(d.gradeLetter, commitCountColor(periodCommits))}>
                  {periodCommitsLabel}
                </div>
                {commitsColumnLabel(d.metricLabel)}
              </RepoBadge>

              </>
              )}
            </div>
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
              commitTimestamps: repo.commitTimestamps,
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
              const gridColumns = isMobile ? '1fr' : hasSL || hasTM ? '1fr 1fr' : '1fr'
              const economicRowDeltas = hasSL ? slRowDeltas : tmRowDeltas

              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridColumns,
                    gap: '10px 14px',
                    marginBottom: '10px',
                  }}
                >
                  {economicScore && (
                    <div style={rubricSectionGridStyle('tm', hasSL, hasTM, isMobile)}>
                      <RubricSectionTitle>
                        Holder economics
                        <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)' }}>
                          {' · '}{economicLensLabel(repo)}
                        </span>
                      </RubricSectionTitle>
                      {economicSectionFraming(repo) && (
                        <p className="rubric-source-clamp" style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.35 }}>
                          {economicSectionFraming(repo)}
                        </p>
                      )}
                      {economicScore.rubric.map((row, i) => {
                        const delta = economicRowDeltas?.get(row.label)
                        return (
                        <RubricCriterionRow
                          key={i}
                          label={row.label}
                          weight={row.weight}
                          level={row.level}
                          source={row.source}
                          isMobile={isMobile}
                          deltaEarned={economicRowDeltas ? (delta?.deltaEarned ?? 0) : null}
                          levelChangeLabel={delta?.levelChangeLabel ?? null}
                          isNewRow={delta?.oldLevel == null && !!delta}
                        />
                        )
                      })}
                    </div>
                  )}

                  {!hasSL && !hasTM && (
                    <div style={rubricSectionGridStyle('tm', false, false, isMobile)}>
                      <RubricSectionTitle>Holder economics</RubricSectionTitle>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                        Not yet scored on holder economics.
                      </p>
                    </div>
                  )}

                  <div style={rubricSectionGridStyle('bi', hasSL, hasTM, isMobile)}>
                    <RubricSectionTitle hint={BI_WEIGHTS_TOOLTIP_SHORT}>Builder standards</RubricSectionTitle>
                    {integritySectionFraming(repo) && (
                      <p className="rubric-source-clamp" style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.35 }}>
                        {integritySectionFraming(repo)}
                      </p>
                    )}
                    {repo.builderIntegrity.rubric.map((row, i) => {
                      const delta = biRowDeltas?.get(row.label)
                      return (
                      <RubricCriterionRow
                        key={i}
                        label={row.label}
                        weight={row.weight}
                        level={row.level}
                        source={row.source}
                        isMobile={isMobile}
                        deltaEarned={biRowDeltas ? (delta?.deltaEarned ?? 0) : null}
                        levelChangeLabel={delta?.levelChangeLabel ?? null}
                        isNewRow={delta?.oldLevel == null && !!delta}
                      />
                      )
                    })}
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

            {showSeparateVerdict && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginBottom: '10px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '6px',
                  }}
                >
                  Score summary
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {verdictText}
                </p>
              </div>
            )}

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

            {communityContextEnabled && (
              <CommunityContextSection repoSlug={repo.githubSlug} enabled={communityContextEnabled} />
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
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: isMobile ? 0 : '8px' }}>
          Repos{repoCountLabel}
        </span>
        {isMobile && <div style={{ width: '100%', height: 0 }} />}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginLeft: isMobile ? 0 : 'auto', ...(isMobile ? { width: '100%' } : {}) }}>
          {filters.map(f => (
            <PillButton
              key={f.key}
              active={activeFilter === f.key}
              onClick={() => {
                setActiveFilter(f.key)
                if (f.key === 'needs-rescore') setSortBy('needs-rescore')
              }}
              isMobile={isMobile}
              tooltip={f.tooltip}
            >
              {f.label}
            </PillButton>
          ))}
          {!isMobile && <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 2px' }} />}
          <PillButton
            active={sortBy === 'recent'}
            onClick={() => setSortBy('recent')}
            isMobile={isMobile}
            tooltip={REPO_SORT_TOOLTIPS.recent}
          >
            Recent
          </PillButton>
          <PillButton
            active={sortBy === 'commits'}
            onClick={() => setSortBy('commits')}
            isMobile={isMobile}
            tooltip={REPO_SORT_TOOLTIPS.commits}
          >
            Most active
          </PillButton>
          <PillButton
            active={sortBy === 'needs-rescore'}
            onClick={() => setSortBy('needs-rescore')}
            isMobile={isMobile}
            tooltip={REPO_SORT_TOOLTIPS['needs-rescore']}
          >
            Needs rescore
          </PillButton>
          <PillButton
            active={sortBy === 'grade'}
            onClick={() => setSortBy('grade')}
            isMobile={isMobile}
            tooltip={REPO_SORT_TOOLTIPS.grade}
          >
            Grades
          </PillButton>
          {isMobile && <div style={{ width: '100%', height: 0 }} />}
          <div style={isMobile ? { width: '100%', display: 'flex' } : undefined}>
            <RepoWindowToggle period={repoPeriod} onChange={setRepoPeriod} stretchMobile={isMobile} />
          </div>
          {!isMobile && <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 2px' }} />}
          <PillButton
            active={activityScope === 'active'}
            onClick={() => setActivityScope('active')}
            isMobile={isMobile}
            tooltip={REPO_SCOPE_TOOLTIPS.active}
          >
            Active
          </PillButton>
          <PillButton
            active={activityScope === 'all'}
            onClick={() => setActivityScope('all')}
            isMobile={isMobile}
            tooltip={REPO_SCOPE_TOOLTIPS.all}
          >
            All
          </PillButton>
        </div>
      </div>

      <RepoCardLegend />

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
