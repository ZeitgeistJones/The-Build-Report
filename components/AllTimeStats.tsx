'use client'

import { useState } from 'react'

interface Props {
  totalRepos: number
  totalCommits30d: number
  activeDays30d: number
  lastCommitAt: string | null
  lastCommitRepo: string | null
}

function formatLastCommit(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

interface StatCardProps {
  label: string
  value: string
  sub: string
  tooltip?: string
}

function StatCard({ label, value, sub, tooltip }: StatCardProps) {
  const [show, setShow] = useState(false)
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </div>
        {tooltip && (
          <button
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onClick={() => setShow(s => !s)}
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'var(--surface-3)',
              color: 'var(--text-muted)',
              fontSize: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'default',
            }}
          >
            ?
          </button>
        )}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
        {sub}
      </div>
      {tooltip && show && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: 0,
          background: 'var(--surface-3)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          padding: '8px 10px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          width: '200px',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          {tooltip}
        </div>
      )}
    </div>
  )
}

export default function AllTimeStats({ totalRepos, totalCommits30d, activeDays30d, lastCommitAt, lastCommitRepo }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '10px',
      marginBottom: '24px',
    }}>
      <StatCard
        label="Total repos"
        value={totalRepos.toString()}
        sub="all public on GitHub"
        tooltip="Total number of public repositories on the clawdbotatg GitHub account."
      />
      <StatCard
        label="Commits"
        value={totalCommits30d.toLocaleString()}
        sub="last 30 days"
        tooltip="Total commits across all tracked repos in the last 30 days."
      />
      <StatCard
        label="Active days"
        value={activeDays30d.toString()}
        sub="last 30 days"
        tooltip="Number of calendar days in the last 30 with at least one commit across any tracked repo."
      />
      <StatCard
        label="Last commit"
        value={lastCommitAt ? formatLastCommit(lastCommitAt) : '—'}
        sub={lastCommitRepo ?? ''}
      />
    </div>
  )
}
