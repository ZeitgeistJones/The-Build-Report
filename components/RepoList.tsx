'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { Repo, Tag, Level, Confidence } from '@/lib/scores'
import { timeAgo } from '@/lib/github'
import { gradeColor } from '@/lib/gradeLetters'
import { isUnscoredRecent } from '@/lib/recentRepos'
import { isAutoInferredNote } from '@/lib/repoFilters'
import { getScoringStatus } from '@/lib/scoringStatus'
import GateBlur from '@/components/wallet/GateBlur'
import GateOverlay from '@/components/wallet/GateOverlay'
import { useClawdAccess } from '@/components/wallet/ClawdAccessContext'
import RepoScoreButton from '@/components/RepoScoreButton'
import { useGradePeriod } from '@/components/GradePeriodContext'
import { Period } from '@/lib/grades'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'
import { type RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import InfoTooltip from '@/components/InfoTooltip'
import ScoreTypeBadge from '@/components/ScoreTypeBadge'
import {
  CONFIDENCE_LABEL,
  formatBaselineDate,
  getConfidenceTooltip,
  isLaunchBaseline,
  looksLikeBaselineDate,
  RESCORE_SUMMARY_NOTE,
} from '@/lib/scoringCopy'

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

const LEVEL_STYLES: Record<Level, { color: string; bg: string }> = {
  high: { color: '#5cb87a', bg: 'rgba(92,184,122,0.1)' },
  mid: { color: '#d4943a', bg: 'rgba(212,148,58,0.1)' },
  low: { color: '#e05c5c', bg: 'rgba(224,92,92,0.1)' },
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

function formatScoredDateLabel(scoredAt: string | null | undefined): string {
  if (!scoredAt) return 'unknown'
  const d = new Date(scoredAt)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return scoredAt
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
          <span style={{ color: 'var(--text-muted)' }}>Token mechanic: </span>
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

function repoCommitsForPeriod(repo: RepoWithLive, period: Period): number {
  if (period === '7d') return repo.commits7d ?? 0
  if (period === '30d') return repo.commits30d ?? 0
  return (repo.commits30d ?? 0) + (repo.commits30_60 ?? 0)
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
  const [density, setDensity] = useState<Density>('compact')
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set())
  const [repoItems, setRepoItems] = useState(repos)
  const [rescoreSummaries, setRescoreSummaries] = useState(initialRescoreSummaries)
  const { unlocked } = useClawdAccess()
  const { period } = useGradePeriod()
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

  const filtered = repoItems
    .filter(r => activeFilter === 'all' || r.tag === activeFilter)
    .sort((a, b) => {
      if (githubSlugOrder.length) {
        const aIdx = githubOrderIndex(a.githubSlug, githubSlugOrder)
        const bIdx = githubOrderIndex(b.githubSlug, githubSlugOrder)
        if (aIdx !== bIdx) return aIdx - bIdx
      }

      const aPushed = a.pushedAt ? new Date(a.pushedAt).getTime() : 0
      const bPushed = b.pushedAt ? new Date(b.pushedAt).getTime() : 0
      if (aPushed !== bPushed) return bPushed - aPushed

      return a.name.localeCompare(b.name)
    })

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
    const ts = TAG_STYLES[repo.tag]
    const borderColor = TAG_BORDER_COLORS[repo.tag]
    const auto = isAutoInferred(repo)
    const pending = isUnscoredRecent(repo)
    const previewLine = formatPreviewLine(repo.description, repo.verdict, pending)
    const periodCommits = repoCommitsForPeriod(repo, period)
    const commitSuffix = periodCommits > 0 ? ` · ${periodCommits} commits (${period})` : ''
    const sinceScored = getScoreAgeDisplay(repo, pending)

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
                {!pending && repo.scoredAt && (
                  <ScoreTypeBadge adminNote={repo.adminNote} />
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
              <div style={{ textAlign: 'center', minWidth: '40px' }}>
                {repo.tokenMechanic ? (
                  <>
                    <div style={{ fontSize: `${d.gradeLetter}px`, fontWeight: 600, fontFamily: 'var(--font-mono)', color: gradeColor(repo.tokenMechanic.letter) }}>
                      {repo.tokenMechanic.letter}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>{repo.tokenMechanic.pct}%</div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', paddingTop: '3px' }}>N/A</div>
                )}
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>token<br />mechanic</div>
              </div>

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
            onScored={handleScored}
          />
        </div>

        {isExpanded && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
            {pending && (
              <div style={{
                marginBottom: '12px',
                padding: '8px 12px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}>
                This repo was recently pushed on GitHub and appears here for recency tracking. Run autoscore or Score to add rubric grades.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '14px' }}>
              {!pending && repo.tokenMechanic && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Token mechanic
                  </div>
                  {repo.tokenMechanic.rubric.map((row, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      marginBottom: '6px',
                      flexWrap: isMobile ? 'wrap' : 'nowrap',
                    }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, lineHeight: 1.4 }}>{row.label}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: '36px', textAlign: 'right', flexShrink: 0, paddingTop: '1px' }}>{row.weight}</span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: '99px',
                        color: LEVEL_STYLES[row.level].color,
                        background: LEVEL_STYLES[row.level].bg,
                        flexShrink: 0,
                      }}>
                        {row.level}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        maxWidth: isMobile ? undefined : '220px',
                        width: isMobile ? '100%' : undefined,
                        textAlign: isMobile ? 'left' : 'right',
                        lineHeight: 1.3,
                        flexShrink: isMobile ? 1 : 0,
                      }}>
                        {row.source}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!pending && !repo.tokenMechanic && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Token mechanic
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Not scored — infrastructure repos are not expected to have a direct token mechanic. Value shows up in downstream consumer apps.
                  </p>
                </div>
              )}

              {!pending && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Builder integrity
                </div>
                {repo.builderIntegrity.rubric.map((row, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '6px',
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, lineHeight: 1.4 }}>{row.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: '36px', textAlign: 'right', flexShrink: 0, paddingTop: '1px' }}>{row.weight}</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: '99px',
                      color: LEVEL_STYLES[row.level].color,
                      background: LEVEL_STYLES[row.level].bg,
                      flexShrink: 0,
                    }}>
                      {row.level}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      maxWidth: isMobile ? undefined : '220px',
                      width: isMobile ? '100%' : undefined,
                      textAlign: isMobile ? 'left' : 'right',
                      lineHeight: 1.3,
                      flexShrink: isMobile ? 1 : 0,
                    }}>
                      {row.source}
                    </span>
                  </div>
                ))}
              </div>
              )}
            </div>

            {rescoreMeta && <RescoreSummaryBlock meta={rescoreMeta} />}

            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '12px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              {repo.verdict}
            </div>

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
        marginBottom: '12px',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '10px' : 0,
      }}>
        <div style={{ fontSize: '11px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Repos
          {activeFilter === 'all'
            ? ` · ${repoItems.length}`
            : ` · ${filtered.length} of ${repoItems.length}`}
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
