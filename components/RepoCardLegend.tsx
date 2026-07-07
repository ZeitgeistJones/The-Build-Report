'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'build-report-card-legend-open'

const LEGEND_ITEMS = [
  {
    label: 'Tag',
    text: 'Repo type — picks which lens Holder economics is scored through (direct burn, supply lock, or shipping leverage).',
  },
  {
    label: 'Holder economics',
    text: 'Repo Grade for holder economic impact. Burn and supply-lock repos are scored on direct CLAWD burn or lock, and count toward the Ecosystem Grade for Holder economics at the top. Infrastructure, indirect, and theoretical repos are scored on shipping leverage — how much they multiply the builder\u2019s ability to ship consumer apps that burn or lock CLAWD.',
  },
  {
    label: '“not in avg”',
    text: 'This Repo Grade is shown on the card but not averaged into the Ecosystem Grade for Holder economics at the top — because it\u2019s scored on shipping leverage, not direct burn.',
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
    text: 'Each card shows two Repo Grades — Holder economics and Builder standards. Colors show A–F only. Builder activity is an Ecosystem Grade shown at the top panel, not on cards.',
  },
] as const

export default function RepoCardLegend() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      setOpen(sessionStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  function toggle() {
    setOpen(prev => {
      const next = !prev
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? '1' : '0')
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
