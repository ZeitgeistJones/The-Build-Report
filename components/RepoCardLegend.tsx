'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'build-report-card-legend-open'

const LEGEND_ITEMS = [
  {
    label: 'Tag',
    text: 'Repo type — picks which holder-value grade applies: Holder economics (direct burn / supply lock) or Shipping leverage (infra / indirect / theoretical).',
  },
  {
    label: 'Holder economics',
    text: 'Repo Grade for direct CLAWD burn or lock impact. Rolls up into the Holder economics Ecosystem Grade at the top.',
  },
  {
    label: 'shipping leverage',
    text: 'Repo Grade for how much infra/tooling multiplies shipping of consumer burn/lock apps. Rolls up into the Shipping leverage Ecosystem Grade at the top — a sibling to Holder economics, not a sub-score of it.',
  },
  {
    label: 'Builder standards',
    text: 'Observable safety, testing, and transparency — scored on every repo, with rules that vary by repo type.',
  },
  {
    label: 'Shipping / Stable / Done',
    text: 'Activity context for this time window — not a letter grade. Done means quiet is expected.',
  },
  {
    label: 'Letter grades',
    text: 'Each card shows Builder standards plus either Holder economics or Shipping leverage (by tag). Colors show A–F only. Builder activity is Ecosystem-only at the top; the two holder-value Ecosystem Grades roll up the matching repo samples.',
  },
] as const

export default function RepoCardLegend() {
  // Default OPEN so first-time visitors see the key without hunting for it.
  // Once a user explicitly closes it, the dismissal persists across visits.
  const [open, setOpen] = useState(true)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '0') setOpen(false)
    } catch {
      /* ignore */
    }
  }, [])

  function toggle() {
    setOpen(prev => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div
      style={{
        marginBottom: '10px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--surface-2)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '8px 12px',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          textAlign: 'left',
        }}
      >
        <span>Card key — what badges and grades mean</span>
        <span aria-hidden style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: '0 12px 10px',
            borderTop: '1px solid var(--border)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
            {LEGEND_ITEMS.map(item => (
              <li key={item.label} style={{ marginBottom: '6px' }}>
                <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</strong>
                {' — '}
                {item.text}
              </li>
            ))}
          </ul>
          <p style={{ margin: '8px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
            Full rubrics and tag definitions on{' '}
            <Link href="/how-we-score#hw-score-scale" style={{ color: 'var(--accent)' }}>
              How we score ↗
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
