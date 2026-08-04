'use client'

import { useMemo, useState } from 'react'
import type { UtilityIndexRow } from '@/lib/utilityIndex'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

type FilterId = 'all' | 'clawd' | 'cv'

function hasRealUtility(v: string | null): boolean {
  return Boolean(v && v !== 'none' && v !== 'unknown')
}

function formatUpgradeDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function utilityLabel(v: string | null): string {
  if (v == null) return '—'
  if (v === 'none') return 'none'
  if (v === 'unknown') return 'unknown'
  return v
}

export default function UtilityLedger({
  rows,
  enrichedCount,
  totalCount,
  updatedAt,
}: {
  rows: UtilityIndexRow[]
  enrichedCount: number
  totalCount: number
  updatedAt: string | null
}) {
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<FilterId>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(row => {
      if (filter === 'clawd' && !hasRealUtility(row.clawdUtility)) return false
      if (filter === 'cv' && !hasRealUtility(row.cvUtility)) return false
      if (!q) return true
      const hay = `${row.slug} ${row.description ?? ''} ${row.clawdUtility ?? ''} ${row.cvUtility ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [rows, filter, query])

  const pills: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'clawd', label: 'Has CLAWD' },
    { id: 'cv', label: 'Has CV' },
  ]

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {enrichedCount < totalCount
          ? `Index building · ${enrichedCount} of ${totalCount} enriched`
          : `${totalCount} repos indexed`}
        {updatedLabel ? ` · updated ${updatedLabel}` : ''}
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '14px',
        }}
      >
        {pills.map(p => {
          const active = filter === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setFilter(p.id)}
              style={{
                fontSize: '11px',
                minHeight: isMobile ? MIN_TAP : undefined,
                padding: '6px 10px',
                borderRadius: 'var(--radius-pill)',
                border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
                background: active ? 'var(--accent-dim)' : 'var(--surface-1)',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          )
        })}
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search repos…"
          aria-label="Search utility ledger"
          style={{
            flex: '1 1 160px',
            minWidth: '140px',
            fontSize: '12px',
            padding: '8px 10px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {totalCount === 0
            ? 'Utility index is empty — the daily cron will start filling it after deploy.'
            : 'No repos match this filter.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(row => (
            <a
              key={row.slug}
              href={`https://github.com/clawdbotatg/${row.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                padding: '12px 14px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                opacity: row.archived ? 0.72 : 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '8px',
                  alignItems: 'baseline',
                  marginBottom: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {row.slug}
                  {row.isFork ? (
                    <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>
                      fork
                    </span>
                  ) : null}
                </span>
                {row.confidence === 'low' && row.clawdUtility != null ? (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>low confidence</span>
                ) : null}
              </div>
              <div
                style={{
                  display: 'grid',
                  gap: '4px',
                  fontSize: '12px',
                  lineHeight: 1.45,
                  color: 'var(--text-secondary)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>CLAWD </span>
                  {utilityLabel(row.clawdUtility)}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>CV </span>
                  {utilityLabel(row.cvUtility)}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Upgrade </span>
                  {row.lastUpgradeLabel} · {formatUpgradeDate(row.lastUpgradeAt)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
