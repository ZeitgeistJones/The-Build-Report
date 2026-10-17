'use client'

// $CLAWD mentions feed — monthly volume chart, source filter, and linked mention list.
import { useMemo, useState } from 'react'
import type { ClawdMention, ClawdMentionSource } from '@/lib/clawdMentions'

interface Props {
  mentions: ClawdMention[]
}

const SOURCE_LABELS: Record<ClawdMentionSource, string> = {
  farcaster: 'Farcaster',
  bluesky: 'Bluesky',
  hackernews: 'Hacker News',
  github: 'GitHub',
  podcast: 'Podcasts',
}

const SOURCE_COLORS: Record<ClawdMentionSource, string> = {
  farcaster: '#8a63d2',
  bluesky: '#1185fe',
  hackernews: '#ff6600',
  github: 'var(--text-secondary)',
  podcast: 'var(--green)',
}

type Filter = 'all' | ClawdMentionSource

const PAGE_SIZE = 50

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' })
}

export default function ClawdMentionsFeed({ mentions }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [month, setMonth] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const counts = useMemo(() => {
    const bySource: Partial<Record<ClawdMentionSource, number>> = {}
    for (const m of mentions) bySource[m.source] = (bySource[m.source] ?? 0) + 1
    return bySource
  }, [mentions])

  const sourceFiltered = filter === 'all' ? mentions : mentions.filter(m => m.source === filter)

  const months = useMemo(() => {
    const byMonth = new Map<string, number>()
    for (const m of sourceFiltered) byMonth.set(monthKey(m.at), (byMonth.get(monthKey(m.at)) ?? 0) + 1)
    if (!byMonth.size) return []
    // Fill gaps so quiet months show as empty bars rather than disappearing.
    const keys = [...byMonth.keys()].sort()
    const out: { key: string; count: number }[] = []
    let [y, mo] = keys[0].split('-').map(Number)
    const [ly, lm] = keys[keys.length - 1].split('-').map(Number)
    while (y < ly || (y === ly && mo <= lm)) {
      const key = `${y}-${String(mo).padStart(2, '0')}`
      out.push({ key, count: byMonth.get(key) ?? 0 })
      mo++
      if (mo > 12) {
        mo = 1
        y++
      }
    }
    return out
  }, [sourceFiltered])

  const maxMonth = Math.max(1, ...months.map(m => m.count))
  const shown = month ? sourceFiltered.filter(m => monthKey(m.at) === month) : sourceFiltered

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: '12px',
    padding: '5px 10px',
    borderRadius: '999px',
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
    background: active ? 'var(--surface-2)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  })

  if (!mentions.length) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        No mentions collected yet. The first overnight pass fills this in.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <button type="button" style={pill(filter === 'all')} aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setMonth(null); setLimit(PAGE_SIZE) }}>
          All · {mentions.length}
        </button>
        {(Object.keys(SOURCE_LABELS) as ClawdMentionSource[])
          .filter(s => counts[s])
          .map(s => (
            <button
              key={s}
              type="button"
              style={pill(filter === s)}
              aria-pressed={filter === s}
              onClick={() => { setFilter(s); setMonth(null); setLimit(PAGE_SIZE) }}
            >
              {SOURCE_LABELS[s]} · {counts[s]}
            </button>
          ))}
      </div>

      <section>
        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Mentions per month {month && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· showing {monthLabel(month)} — <button type="button" onClick={() => setMonth(null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '11px' }}>show all</button></span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '110px', overflowX: 'auto', paddingBottom: '2px' }}>
          {months.map(m => (
            <button
              key={m.key}
              type="button"
              title={`${monthLabel(m.key)}: ${m.count} mention${m.count === 1 ? '' : 's'}`}
              onClick={() => { setMonth(month === m.key ? null : m.key); setLimit(PAGE_SIZE) }}
              style={{
                flex: '1 0 28px',
                maxWidth: '56px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '3px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{m.count || ''}</span>
              <span
                style={{
                  width: '100%',
                  height: `${Math.max(m.count ? 4 : 1, (m.count / maxMonth) * 70)}px`,
                  borderRadius: '3px 3px 0 0',
                  background: month === m.key ? 'var(--accent)' : 'var(--accent-border)',
                }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{monthLabel(m.key)}</span>
            </button>
          ))}
        </div>
      </section>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {shown.slice(0, limit).map(m => (
          <li
            key={m.id}
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'baseline', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: SOURCE_COLORS[m.source] }}>
                {SOURCE_LABELS[m.source]}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{formatDate(m.at)}</span>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.author}</span>
              {m.context && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>· {m.context}</span>}
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
              {m.text}
            </p>
            <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--accent)' }}>
              Open original ↗
            </a>
          </li>
        ))}
      </ol>

      {shown.length > limit && (
        <button type="button" onClick={() => setLimit(l => l + PAGE_SIZE)} style={{ ...pill(false), alignSelf: 'center', padding: '8px 16px' }}>
          Show more ({shown.length - limit} left)
        </button>
      )}
    </div>
  )
}
