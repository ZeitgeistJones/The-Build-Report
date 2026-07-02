'use client'

import { useState, type ReactNode } from 'react'
import { Repo, Tag, Level } from '@/lib/scores'
import { timeAgo } from '@/lib/github'
import { gradeColor } from '@/lib/gradeLetters'
import { isUnscoredRecent } from '@/lib/recentRepos'
import { isAutoInferredNote } from '@/lib/repoFilters'

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
  compact: { cardPadding: '14px 16px', name: 14, preview: 12, lastPushed: 12, gradeLetter: 20 },
  comfortable: { cardPadding: '18px 16px', name: 15, preview: 13, lastPushed: 13, gradeLetter: 22 },
} as const

const CARD_META_COLOR = '#9a9590'

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
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '12px',
        padding: '4px 11px',
        borderRadius: '99px',
        border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        transition: 'all 0.15s',
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

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High confidence',
  mid: 'Medium confidence',
  low: 'Low confidence',
}

function githubOrderIndex(slug: string, order: string[]): number {
  const idx = order.indexOf(slug)
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}

interface RepoWithLive extends Repo {
  description: string | null
  lastCommitAt: string | null
  pushedAt: string | null
  commits30d: number | null
}

interface Props {
  repos: RepoWithLive[]
  githubSlugOrder?: string[]
}

export default function RepoList({ repos, githubSlugOrder = [] }: Props) {
  const [activeFilter, setActiveFilter] = useState<Tag | 'all'>('all')
  const [density, setDensity] = useState<Density>('compact')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const d = DENSITY_STYLES[density]

  const filters: { key: Tag | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'direct', label: 'Direct' },
    { key: 'supply-lock', label: 'Supply lock' },
    { key: 'indirect', label: 'Indirect' },
    { key: 'infrastructure', label: 'Infrastructure' },
    { key: 'theoretical', label: 'Theoretical' },
  ]

  const filtered = repos
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

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Repos
          {activeFilter === 'all'
            ? ` · ${repos.length}`
            : ` · ${filtered.length} of ${repos.length}`}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          {filters.map(f => (
            <PillButton
              key={f.key}
              active={activeFilter === f.key}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </PillButton>
          ))}
          <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 4px' }} />
          <PillButton active={density === 'compact'} onClick={() => setDensity('compact')}>
            Compact
          </PillButton>
          <PillButton active={density === 'comfortable'} onClick={() => setDensity('comfortable')}>
            Comfortable
          </PillButton>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(repo => {
          const isExpanded = expandedIds.has(repo.id)
          const ts = TAG_STYLES[repo.tag]
          const borderColor = TAG_BORDER_COLORS[repo.tag]
          const auto = isAutoInferred(repo)
          const pending = isUnscoredRecent(repo)
          const previewLine = formatPreviewLine(repo.description, repo.verdict, pending)

          return (
            <div
              key={repo.id}
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                ...(borderColor ? { borderLeft: `3px solid ${borderColor}` } : {}),
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: 'var(--card-elevated)',
              }}
            >
              <button
                onClick={() => toggleExpand(repo.id)}
                style={{
                  width: '100%',
                  padding: d.cardPadding,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
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
                  </div>

                  <div style={{ fontSize: `${d.name}px`, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em', lineHeight: 1.35 }}>
                    {repo.name}
                  </div>

                  {previewLine && (
                    <div style={{
                      fontSize: `${d.preview}px`,
                      color: CARD_META_COLOR,
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {previewLine}
                    </div>
                  )}

                  <div style={{ fontSize: `${d.lastPushed}px`, color: CARD_META_COLOR, marginTop: '2px' }}>
                    Last pushed {timeAgo(repo.pushedAt ?? repo.lastCommitAt)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexShrink: 0 }}>
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
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{repo.tokenMechanic.pct}%</div>
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
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{repo.builderIntegrity.pct}%</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>builder<br />integrity</div>
                  </div>

                  <div style={{ fontSize: '14px', color: 'var(--text-muted)', paddingTop: '3px', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                    ↓
                  </div>
                  </>
                  )}
                </div>
              </button>

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
                      This repo was recently pushed on GitHub and appears here for recency tracking. Run autoscore or hand-score to add rubric grades.
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '14px' }}>
                    {!pending && repo.tokenMechanic && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          Token mechanic
                        </div>
                        {repo.tokenMechanic.rubric.map((row, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '6px', flexWrap: 'nowrap' }}>
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
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '220px', textAlign: 'right', lineHeight: 1.3, flexShrink: 0 }}>
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
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '6px', flexWrap: 'nowrap' }}>
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
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '220px', textAlign: 'right', lineHeight: 1.3, flexShrink: 0 }}>
                            {row.source}
                          </span>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>

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
                    {CONFIDENCE_LABEL[repo.confidence]}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
