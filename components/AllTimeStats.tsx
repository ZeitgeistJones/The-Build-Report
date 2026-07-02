'use client'

import { useState } from 'react'
import { pctChange } from '@/lib/grades'

interface Props {
  totalRepos: number
  totalCommits30d: number
  totalCommits7d: number
  totalCommits30_60: number
  totalCommits7_14: number
  activeDays30d: number
  activeDays7d: number
  activeDays30_60: number
  activeDays7_14: number
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

function formatStatTrend(curr: number, prev: number, windowLabel: string): string {
  const change = pctChange(curr, prev)
  if (change === null) return `new vs ${windowLabel}`
  if (change > 0) return `+${change}% vs ${windowLabel}`
  if (change < 0) return `${change}% vs ${windowLabel}`
  return `0% vs ${windowLabel}`
}

interface StatCardProps {
  label: string
  value: string
  sub: string
  trend?: string
  tooltip?: string
}

function StatCard({ label, value, sub, trend, tooltip }: StatCardProps) {
  const [show, setShow] = useState(false)
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      position: 'relative',
      boxShadow: 'var(--card-elevated)',
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
      {trend && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
          {trend}
        </div>
      )}
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
          width: '220px',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          {tooltip}
        </div>
      )}
    </div>
  )
}

export default function AllTimeStats({
  totalRepos,
  totalCommits30d,
  totalCommits7d,
  totalCommits30_60,
  totalCommits7_14,
  activeDays30d,
  activeDays7d,
  activeDays30_60,
  activeDays7_14,
  lastCommitAt,
  lastCommitRepo,
}: Props) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{
        fontSize: '11px',
        color: 'var(--accent)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: '10px',
      }}>
        Activity snapshot
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
      }}>
        <StatCard
          label="Total repos"
          value={totalRepos.toString()}
          sub="all public on GitHub"
          tooltip="Total number of public repositories on the clawdbotatg GitHub account."
        />
        <StatCard
          label="Commits (30d)"
          value={totalCommits30d.toLocaleString()}
          sub="last 30 days"
          trend={formatStatTrend(totalCommits30d, totalCommits30_60, 'prior 30d')}
          tooltip="Commits across up to 40 repos pushed in the last 30 days (scored repos prioritized). Compared to days 31–60."
        />
        <StatCard
          label="Commits (7d)"
          value={totalCommits7d.toLocaleString()}
          sub="last 7 days"
          trend={formatStatTrend(totalCommits7d, totalCommits7_14, 'prior 7d')}
          tooltip="Commits across up to 40 repos pushed in the last 30 days (scored repos prioritized). Compared to days 8–14."
        />
        <StatCard
          label="Active days (30d)"
          value={activeDays30d.toString()}
          sub="last 30 days"
          trend={formatStatTrend(activeDays30d, activeDays30_60, 'prior 30d')}
          tooltip="Calendar days with at least one commit in the sampled repo set. Compared to days 31–60."
        />
        <StatCard
          label="Active days (7d)"
          value={activeDays7d.toString()}
          sub="last 7 days"
          trend={formatStatTrend(activeDays7d, activeDays7_14, 'prior 7d')}
          tooltip="Calendar days with at least one commit in the sampled repo set. Compared to days 8–14."
        />
        <StatCard
          label="Last commit"
          value={lastCommitAt ? formatLastCommit(lastCommitAt) : '—'}
          sub={lastCommitRepo ?? ''}
          tooltip="Most recent commit found while scanning the sampled repo set."
        />
      </div>
    </div>
  )
}
