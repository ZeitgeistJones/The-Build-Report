'use client'

// Holder Benefits timeline — curated dated $CLAWD / CV value events + live grade moves.
import { useState } from 'react'
import { useNormieMode } from './NormieModeProvider'
import {
  HOLDER_BENEFIT_KIND_LABELS,
  type HolderBenefit,
  type HolderBenefitKind,
  type HolderGradeMove,
} from '@/lib/holderBenefits'
import type { BurnSnapshot } from '@/lib/burnSnapshot'

interface Props {
  benefits: HolderBenefit[]
  gradeMoves: HolderGradeMove[]
  burn: BurnSnapshot | null
}

const KIND_COLORS: Record<HolderBenefitKind, string> = {
  burn: 'var(--red)',
  lock: 'var(--accent)',
  utility: 'var(--green)',
  access: 'var(--text-secondary)',
  cv: 'var(--accent)',
}

type Filter = 'all' | HolderBenefitKind

const FILTERS: Filter[] = ['all', 'burn', 'lock', 'cv', 'utility', 'access']

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' })
}

function formatClawd(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString('en-US')
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  margin: '0 0 10px',
}

const card: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '14px 16px',
}

export default function HolderBenefitsTimeline({ benefits, gradeMoves, burn }: Props) {
  const { normie } = useNormieMode()
  const [filter, setFilter] = useState<Filter>('all')
  const shown = filter === 'all' ? benefits : benefits.filter(b => b.kind === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {burn && burn.clawdBurned > 0 && (
        <section style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'baseline' }}>
          <span style={{ ...sectionLabel, margin: 0 }}>Build Report buy-and-burn</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 600, color: 'var(--red)' }}>
            {formatClawd(burn.clawdBurned)} CLAWD burned
          </span>
          {burn.lastBurnAt && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>last burn {formatDate(burn.lastBurnAt)}</span>
          )}
        </section>
      )}

      <section>
        <h2 style={sectionLabel}>Recent holder-economics grade moves</h2>
        {gradeMoves.length === 0 ? (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            No burn or supply-lock project changed its holder-economics grade in the last 90 days.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gradeMoves.map(m => (
              <div key={m.slug} style={card}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {formatDate(m.rescoreAt)}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{m.name}</span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: m.direction === 'up' ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {m.oldLabel} → {m.newLabel}
                  </span>
                </div>
                {(normie ? m.summaryNormie || m.summary : m.summary) && (
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                    {normie ? m.summaryNormie || m.summary : m.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={sectionLabel}>Benefit history</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
          {FILTERS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              style={{
                fontSize: '12px',
                padding: '5px 10px',
                borderRadius: '999px',
                cursor: 'pointer',
                border: `1px solid ${filter === f ? 'var(--accent-border)' : 'var(--border)'}`,
                background: filter === f ? 'var(--surface-2)' : 'transparent',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {f === 'all' ? 'All' : HOLDER_BENEFIT_KIND_LABELS[f]}
            </button>
          ))}
        </div>

        <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderLeft: '2px solid var(--border)' }}>
          {shown.map(b => (
            <li key={`${b.sortDate}-${b.project}`} style={{ position: 'relative', padding: '0 0 18px 18px' }}>
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '-6px',
                  top: '5px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: KIND_COLORS[b.kind],
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {b.dateLabel}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: KIND_COLORS[b.kind],
                  }}
                >
                  {HOLDER_BENEFIT_KIND_LABELS[b.kind]}
                </span>
                {b.ended && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ran its course
                  </span>
                )}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{b.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{b.project}</div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                {normie ? b.detailNormie : b.detail}
              </p>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Source: {b.source}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
