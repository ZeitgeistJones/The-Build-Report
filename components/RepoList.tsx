'use client'

import { useState } from 'react'
import { Repo, Tag, Level } from '@/lib/scores'

const TAGSTYLES: Record<Tag, { color: string; bg: string; label: string }> = {
  direct: { color: '#5cb87a', bg: 'rgba(92,184,122,0.12)', label: 'direct' },
  'supply-lock': { color: '#5b9bd5', bg: 'rgba(91,155,213,0.12)', label: 'supply lock' },
  indirect: { color: '#a07cd5', bg: 'rgba(160,124,213,0.12)', label: 'indirect' },
  infrastructure: { color: '#7a7670', bg: 'rgba(122,118,112,0.12)', label: 'infrastructure' },
  theoretical: { color: '#d4943a', bg: 'rgba(212,148,58,0.12)', label: 'theoretical' },
}

const STATUSSTYLES = {
  active: { color: '#5cb87a', bg: 'rgba(92,184,122,0.08)', label: 'active' },
  dormant: { color: '#e05c5c', bg: 'rgba(224,92,92,0.08)', label: 'dormant' },
  archived: { color: '#5e5a55', bg: 'rgba(94,90,85,0.08)', label: 'archived' },
} as const

const LEVELSTYLES: Record<Level, { color: string; bg: string }> = {
  high: { color: '#5cb87a', bg: 'rgba(92,184,122,0.1)' },
  mid: { color: '#d4943a', bg: 'rgba(212,148,58,0.1)' },
  low: { color: '#e05c5c', bg: 'rgba(224,92,92,0.1)' },
}

const CONFIDENCELABEL: Record<string, string> = {
  high: 'High confidence',
  mid: 'Medium confidence',
  low: 'Low confidence / R&D',
}

function gradeColor(letter: string) {
  if (letter === 'A') return 'var(--accent)'
  if (letter === 'B') return 'var(--green)'
  if (letter === 'C') return 'var(--amber)'
  return 'var(--red)'
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

  const filtered = repos
    .filter(r => activeFilter === 'all' || r.tag === activeFilter)
    .sort((a, b) => {
      const aTime = a.lastCommitAt ? new Date(a.lastCommitAt).getTime() : 0
      const bTime = b.lastCommitAt ? new Date(b.lastCommitAt).getTime() : 0
      if (aTime !== bTime) return bTime - aTime

      const aCommits = a.commits30d ?? 0
      const bCommits = b.commits30d ?? 0
      if (aCommits !== bCommits) return bCommits - aCommits

      const aAuto = isAutoInferred(a)
      const bAuto = isAutoInferred(b)
      if (aAuto !== bAuto) return aAuto ? 1 : -1

      const scoreA = a.holderRelevance?.pct ?? a.builderIntegrity.pct
      const scoreB = b.holderRelevance?.pct ?? b.builderIntegrity.pct
      return scoreB - scoreA
    })

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Repos
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                fontSize: 12,
                padding: '4px 11px',
                borderRadius: 99,
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(repo => {
          const isExpanded = expandedIds.has(repo.id)
          const ts = TAGSTYLES[repo.tag]
          const ss = STATUSSTYLES[repo.status]
          const auto = isAutoInferred(repo)

          return (
            <div
              key={repo.id}
              style={{
                background: 'var(--surface-1)',
                border: `1px solid ${auto ? 'rgba(255,255,255,0.05)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                opacity: auto ? 0.88 : 1,
              }}
            >
              <button
                onClick={() => toggleExpand(repo.id)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  textAlign: 'left',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 5,
                      marginBottom: 5,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontWeight: 500,
                        color: ts.color,
                        background: ts.bg,
                      }}
                    >
                      {ts.label}
                    </span>

                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontWeight: 500,
                        color: ss.color,
                        background: ss.bg,
                      }}
                    >
                      {ss.label}
                    </span>

                    {auto && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 99,
                          color: 'var(--text-muted)',
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border)',
                          letterSpacing: '0.03em',
                        }}
                      >
                        auto-inferred
                      </span>
                    )}

                    {repo.commits30d === 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 99,
                          color: 'var(--amber)',
                          background: 'rgba(212,148,58,0.1)',
                          border: '1px solid rgba(212,148,58,0.22)',
                          letterSpacing: '0.03em',
                        }}
                      >
                        no commits 30d
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {repo.name}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                    }}
                  >
                    {repo.lastCommitAt ? `Last commit ${formatLastCommit(repo.lastCommitAt)}` : `Scored ${repo.scoredAt}`}
                    {repo.commits30d != null && repo.commits30d > 0 && (
                      <span style={{ marginLeft: 8 }}>{repo.commits30d} commits 30d</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center', minWidth: 40 }}>
                    {repo.holderRelevance ? (
                      <>
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            color: gradeColor(repo.holderRelevance.letter),
                          }}
                        >
                          {repo.holderRelevance.letter}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{repo.holderRelevance.pct}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', paddingTop: 3 }}>
                          NA
                        </div>
                      </>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.2 }}>
                      holder
                      <br />
                      relevance
                    </div>
                  </div>

                  <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />

                  <div style={{ textAlign: 'center', minWidth: 40 }}>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        color: gradeColor(repo.builderIntegrity.letter),
                      }}
                    >
                      {repo.builderIntegrity.letter}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{repo.builderIntegrity.pct}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.2 }}>
                      builder
                      <br />
                      integrity
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      color: 'var(--text-muted)',
                      paddingTop: 3,
                      transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                    }}
                  >
                    ▾
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
                  {auto && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: '8px 12px',
                        background: 'var(--surface-2)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: 'var(--amber)', fontWeight: 500, marginRight: 6 }}>Auto-inferred</span>
                      This repo was not in the original scored set. Scores were generated automatically by Claude
                      based on the repo name, description, and ecosystem context. They are a starting point, not a
                      verdict. Hand scoring will replace this.
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 14 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: 8,
                        }}
                      >
                        Holder relevance
                      </div>

                      {repo.holderRelevance ? (
                        repo.holderRelevance.rubric.map((row, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                              marginBottom: 6,
                            }}
                          >
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>
                              {row.label}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                fontFamily: 'var(--font-mono)',
                                width: 28,
                                textAlign: 'right',
                                flexShrink: 0,
                                paddingTop: 1,
                              }}
                            >
                              {row.weight}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 500,
                                padding: '2px 8px',
                                borderRadius: 99,
                                color: LEVELSTYLES[row.level].color,
                                background: LEVELSTYLES[row.level].bg,
                                flexShrink: 0,
                              }}
                            >
                              {row.level}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                maxWidth: 140,
                                textAlign: 'right',
                                lineHeight: 1.3,
                                flexShrink: 0,
                              }}
                            >
                              {row.source}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Not scored — infrastructure repos are not expected to have a token mechanic. Their value shows
                          up in the quality of consumer apps built on top.
                        </p>
                      )}
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: 8,
                        }}
                      >
                        Builder integrity
                      </div>

                      {repo.builderIntegrity.rubric.map((row, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>
                            {row.label}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                              width: 28,
                              textAlign: 'right',
                              flexShrink: 0,
                              paddingTop: 1,
                            }}
                          >
                            {row.weight}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              padding: '2px 8px',
                              borderRadius: 99,
                              color: LEVELSTYLES[row.level].color,
                              background: LEVELSTYLES[row.level].bg,
                              flexShrink: 0,
                            }}
                          >
                            {row.level}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              maxWidth: 140,
                              textAlign: 'right',
                              lineHeight: 1.3,
                              flexShrink: 0,
                            }}
                          >
                            {row.source}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {repo.verdict}
                  </div>

                  {repo.adminNote && !auto && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        background: 'var(--surface-2)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span style={{ color: 'var(--accent)', fontWeight: 500, marginRight: 6 }}>Note</span>
                      {repo.adminNote}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: 10,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>Scored {repo.scoredAt}</span>
                    <span>{auto ? 'Auto-inferred low confidence' : CONFIDENCELABEL[repo.confidence]}</span>
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
