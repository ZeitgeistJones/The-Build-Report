'use client'

import { useState } from 'react'
import { pctChange, periodKeyToBase } from '@/lib/grades'
import GateBlur from '@/components/wallet/GateBlur'
import { useClawdAccess } from '@/components/wallet/ClawdAccessContext'
import { useGradePeriod } from '@/components/GradePeriodContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

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
  gated?: boolean
  isMobile: boolean
}

function StatCard({ label, value, sub, trend, tooltip, gated, isMobile }: StatCardProps) {
  const [show, setShow] = useState(false)
  const trendSize = isMobile ? '11px' : '10px'

  const valueContent = (
    <>
      <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
        {sub}
      </div>
      {trend && (
        <div style={{ fontSize: trendSize, color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
          {trend}
        </div>
      )}
    </>
  )

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
              width: isMobile ? MIN_TAP : 14,
              height: isMobile ? MIN_TAP : 14,
              borderRadius: '50%',
              background: isMobile ? 'transparent' : 'var(--surface-3)',
              color: 'var(--text-muted)',
              fontSize: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'default',
              padding: 0,
            }}
          >
            ?
          </button>
        )}
      </div>
      {gated ? <GateBlur locked>{valueContent}</GateBlur> : valueContent}
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
          width: isMobile ? 'min(280px, calc(100vw - 32px))' : '220px',
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
  const { unlocked } = useClawdAccess()
  const { period: periodKey } = useGradePeriod()
  const period = periodKeyToBase(periodKey)
  const isMobile = useIsMobile()
  const gated = !unlocked

  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: '10px',
      }}>
        Activity snapshot
      </div>
      {period === '60d' && (
        <p style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          marginBottom: '10px',
          fontStyle: 'italic',
        }}>
          Activity snapshot shows 30d data — switch to 30d or 7d to align windows.
        </p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: '10px',
      }}>
        <StatCard
          isMobile={isMobile}
          label="Total repos"
          value={totalRepos.toString()}
          sub="all public on GitHub"
          tooltip="Total number of public repositories on the clawdbotatg GitHub account."
        />
        <StatCard
          isMobile={isMobile}
          label="Commits (30d)"
          value={totalCommits30d.toLocaleString()}
          sub="last 30 days"
          trend={formatStatTrend(totalCommits30d, totalCommits30_60, 'prior 30d')}
          tooltip="Commits across up to 40 repos pushed in the last 30 days (scored repos prioritized). Compared to days 31–60."
        />
        <StatCard
          isMobile={isMobile}
          label="Commits (7d)"
          value={totalCommits7d.toLocaleString()}
          sub="last 7 days"
          trend={formatStatTrend(totalCommits7d, totalCommits7_14, 'prior 7d')}
          tooltip="Commits across up to 40 repos pushed in the last 30 days (scored repos prioritized). Compared to days 8–14."
          gated={gated}
        />
        <StatCard
          isMobile={isMobile}
          label="Active days (30d)"
          value={activeDays30d.toString()}
          sub="last 30 days"
          trend={formatStatTrend(activeDays30d, activeDays30_60, 'prior 30d')}
          tooltip="Calendar days with at least one commit in the sampled repo set. Compared to days 31–60."
          gated={gated}
        />
        <StatCard
          isMobile={isMobile}
          label="Active days (7d)"
          value={activeDays7d.toString()}
          sub="last 7 days"
          trend={formatStatTrend(activeDays7d, activeDays7_14, 'prior 7d')}
          tooltip="Calendar days with at least one commit in the sampled repo set. Compared to days 8–14."
          gated={gated}
        />
        <StatCard
          isMobile={isMobile}
          label="Last commit"
          value={lastCommitAt ? formatLastCommit(lastCommitAt) : '—'}
          sub={lastCommitRepo ?? ''}
          tooltip="Most recent commit found while scanning the sampled repo set."
          gated={gated}
        />
      </div>
    </div>
  )
}
