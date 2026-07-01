'use client'

import { useState } from 'react'
import { Repo, Tag, Level } from '@/lib/scores'
import { isUnscoredRecent } from '@/lib/recentRepos'

const TAG_STYLES: Record<Tag, { color: string; bg: string; label: string }> = {
  'direct': { color: '#5cb87a', bg: 'rgba(92,184,122,0.12)', label: 'direct' },
  'supply-lock': { color: '#5b9bd5', bg: 'rgba(91,155,213,0.12)', label: 'supply lock' },
  'indirect': { color: '#a07cd5', bg: 'rgba(160,124,213,0.12)', label: 'indirect' },
  'infrastructure': { color: '#7a7670', bg: 'rgba(122,118,112,0.12)', label: 'infrastructure' },
  'theoretical': { color: '#d4943a', bg: 'rgba(212,148,58,0.12)', label: 'theoretical' },
}

const STATUS_STYLES = {
  active: { color: '#5cb87a', bg: 'rgba(92,184,122,0.08)', label: 'active', title: 'Editorial status at time of scoring' },
  dormant: { color: '#e05c5c', bg: 'rgba(224,92,92,0.08)', label: 'dormant', title: 'Editorial status at time of scoring' },
  archived: { color: '#5e5a55', bg: 'rgba(94,90,85,0.08)', label: 'archived', title: 'Editorial status at time of scoring' },
}

const LEVEL_STYLES: Record<Level, { color: string; bg: string }> = {
  high: { color: '#5cb87a', bg: 'rgba(92,184,122,0.1)' },
  mid: { color: '#d4943a', bg: 'rgba(212,148,58,0.1)' },
  low: { color: '#e05c5c', bg: 'rgba(224,92,92,0.1)' },
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High confidence',
  mid: 'Medium confidence',
  low: 'Low confidence — auto-inferred',
}

function gradeColor(letter: string) {
  if (letter === 'A') return 'var(--accent)'
  if (letter === 'B') return 'var(--green)'
  if (letter === 'C') return 'var(--amber)'
  return 'var(--red)'
}

function parseScoredAt(scoredAt: string): number {
  const t = Date.parse(scoredAt)
  return Number.isNaN(t) ? 0 : t
}

function recencyTimestamp(repo: RepoWithLive): number {
  if (repo.lastCommitAt) return new Date(repo.lastCommitAt).getTime()
  if (repo.pushedAt) return new Date(repo.pushedAt).getTime()
  return parseScoredAt(repo.scoredAt)
}

function activitySubtitle(repo: RepoWithLive): string {
  if (repo.lastCommitAt) return `Last commit ${formatLastCommit(repo.lastCommitAt)}`
  if (repo.pushedAt) return `Last pushed ${formatLastCommit(repo.pushedAt)}`
  return `Scored ${repo.scoredAt}`
}

function formatLastCommit(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

interface RepoWithLive extends Repo {
  lastCommitAt: string | null
  pushedAt: string | null
  commits30d: number | null
}

interface Props {
  repos: RepoWithLive[]
}

export default function RepoList({ repos }: Props) {
  const [activeFilter, setActiveFilter] = useState<Tag | 'all'>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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
      const aTime = recencyTimestamp(a)
      const bTime = recencyTimestamp(b)
      if (aTime !== bTime) return bTime - aTime

      const aCommits = a.commits30d ?? 0
      const bCommits = b.commits30d ?? 0
      if (aCommits !== bCommits) return bCommits - aCommits

      return a.name.localeCompare(b.name)
    })

  function isAutoInferred(repo: RepoWithLive) {
    return (repo.adminNote ?? '').startsWith('Scores auto-inferred')
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
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Repos
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                fontSize: '12px',
                padding: '4px 11px',
                borderRadius: '99px',
                border: `1px solid ${activeFilter === f.key ? 'var(--border-strong)' : 'var(--border)'}`,
                background: activeFilter === f.key ? 'var(--surface-3)' : 'transparent',
                color: activeFilter === f.key ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(repo => {
          const isExpanded = expandedIds.has(repo.id)
          const ts = TAG_STYLES[repo.tag]
          const ss = STATUS_STYLES[repo.status]
          const auto = isAutoInferred(repo)
          const pending = isUnscoredRecent(repo)

          return (
            <div
              key={repo.id}
              style={{
                background: 'var(--surface-1)',
                border: `1px solid ${auto ? 'rgba(255,255,255,0.05)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                opacity: auto ? 0.85 : 1,
              }}
            >
              <button
                onClick={() => toggleExpand(repo.id)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
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
                    <span
                      title={ss.title}
                      style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '99px',
                      fontWeight: 500,
                      color: ss.color,
                      background: ss.bg,
                    }}>
                      {ss.label}
                    </span>
                    {auto && (
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 7px',
                        borderRadius: '99px',
                        color: 'var(--text-muted)',
                        background: 'var(--surface-3)',
                        border: '1px solid var(--border)',
                        letterSpacing: '0.03em',
                      }}>
                        ✦ auto-inferred
                      </span>
                    )}
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

                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {repo.name}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {activitySubtitle(repo)}
                    {repo.commits30d !== null && repo.commits30d > 0 && (
                      <span style={{ marginLeft: '8px' }}>· {repo.commits30d} commits (30d)</span>
                    )}
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
                    {repo.holderRelevance ? (
                      <>
                        <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: gradeColor(repo.holderRelevance.letter) }}>
                          {repo.holderRelevance.letter}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{repo.holderRelevance.pct}%</div>
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', paddingTop: '3px' }}>N/A</div>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>holder<br />relevance</div>
                  </div>

                  <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />

                  <div style={{ textAlign: 'center', minWidth: '40px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: gradeColor(repo.builderIntegrity.letter) }}>
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
                  {auto && (
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
                      <span style={{ color: 'var(--amber)', fontWeight: 500, marginRight: '6px' }}>✦ Auto-inferred:</span>
                      This repo was not in the original scored set. Scores were generated automatically by Claude based on the repo name, description, and ecosystem context. They are a starting point, not a verdict. Hand scoring will replace this.
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '14px' }}>
                    {!pending && repo.holderRelevance && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          Holder relevance
                        </div>
                        {repo.holderRelevance.rubric.map((row, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>{row.label}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: '28px', textAlign: 'right', flexShrink: 0, paddingTop: '1px' }}>{row.weight}</span>
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
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '140px', textAlign: 'right', lineHeight: 1.3, flexShrink: 0 }}>
                              {row.source}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!pending && !repo.holderRelevance && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                          Holder relevance
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Not scored — auto-inferred infrastructure repos are not expected to have a token mechanic. Hand-scored infrastructure may use adapted criteria. Value shows up in downstream consumer apps.
                        </p>
                      </div>
                    )}

                    {!pending && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        Builder integrity
                      </div>
                      {repo.builderIntegrity.rubric.map((row, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>{row.label}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: '28px', textAlign: 'right', flexShrink: 0, paddingTop: '1px' }}>{row.weight}</span>
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
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '140px', textAlign: 'right', lineHeight: 1.3, flexShrink: 0 }}>
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Scored {repo.scoredAt}</span>
                    <span>{auto ? 'Auto-inferred — low confidence' : CONFIDENCE_LABEL[repo.confidence]}</span>
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
