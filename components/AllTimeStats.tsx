'use client'

import { useState } from 'react'
import { pctChange, periodKeyLabel, type Period } from '@/lib/grades'
import type { EcosystemPulse } from '@/lib/ecosystemPulse'
import GateBlur from '@/components/wallet/GateBlur'
import { useClawdAccess } from '@/components/wallet/ClawdAccessContext'
import { useGradePeriod } from '@/components/GradePeriodContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'
import { timeAgo } from '@/lib/github'

interface Props {
  totalRepos: number
  pulse24: EcosystemPulse
  pulse30: EcosystemPulse
  pulse7: EcosystemPulse
  pulse60: EcosystemPulse
  totalCommits24h: number
  totalCommits24_48: number
  totalCommits30d: number
  totalCommits7d: number
  totalCommits30_60: number
  totalCommits7_14: number
  activeDays24h: number
  activeDays24_48: number
  activeDays30d: number
  activeDays7d: number
  activeDays30_60: number
  activeDays7_14: number
  lastCommitAt: string | null
  lastCommitRepo: string | null
}

function formatStatTrend(curr: number, prev: number, windowLabel: string): string {
  const change = pctChange(curr, prev)
  if (change === null) return `new vs ${windowLabel}`
  if (change > 0) return `+${change}% vs ${windowLabel}`
  if (change < 0) return `${change}% vs ${windowLabel}`
  return `0% vs ${windowLabel}`
}

function pulseForPeriod(
  period: Period,
  pulse24: EcosystemPulse,
  pulse7: EcosystemPulse,
  pulse30: EcosystemPulse,
  pulse60: EcosystemPulse,
): EcosystemPulse {
  if (period === '24h') return pulse24
  if (period === '7d') return pulse7
  if (period === '60d') return pulse60
  return pulse30
}

function windowMetrics(
  period: Period,
  props: Props,
): {
  commits: number
  priorCommits: number
  activeDays: number
  priorActiveDays: number
  commitsLabel: string
  activeDaysLabel: string
  priorLabel: string
  showTrend: boolean
} {
  switch (period) {
    case '24h':
      return {
        commits: props.totalCommits24h,
        priorCommits: props.totalCommits24_48,
        activeDays: props.activeDays24h,
        priorActiveDays: props.activeDays24_48,
        commitsLabel: 'Commits (24h)',
        activeDaysLabel: 'Active days (24h)',
        priorLabel: 'prior 24h',
        showTrend: true,
      }
    case '7d':
      return {
        commits: props.totalCommits7d,
        priorCommits: props.totalCommits7_14,
        activeDays: props.activeDays7d,
        priorActiveDays: props.activeDays7_14,
        commitsLabel: 'Commits (7d)',
        activeDaysLabel: 'Active days (7d)',
        priorLabel: 'prior 7d',
        showTrend: true,
      }
    case '60d':
      return {
        commits: props.totalCommits30d + props.totalCommits30_60,
        priorCommits: 0,
        activeDays: Math.min(props.activeDays30d + props.activeDays30_60, 60),
        priorActiveDays: 0,
        commitsLabel: 'Commits (60d)',
        activeDaysLabel: 'Active days (60d)',
        priorLabel: 'prior 60d',
        showTrend: false,
      }
    default:
      return {
        commits: props.totalCommits30d,
        priorCommits: props.totalCommits30_60,
        activeDays: props.activeDays30d,
        priorActiveDays: props.activeDays30_60,
        commitsLabel: 'Commits (30d)',
        activeDaysLabel: 'Active days (30d)',
        priorLabel: 'prior 30d',
        showTrend: true,
      }
  }
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
            type="button"
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

export default function AllTimeStats(props: Props) {
  const { unlocked } = useClawdAccess()
  const { period } = useGradePeriod()
  const isMobile = useIsMobile()
  const gated = !unlocked

  const pulse = pulseForPeriod(period, props.pulse24, props.pulse7, props.pulse30, props.pulse60)
  const window = windowMetrics(period, props)
  const periodLabel = periodKeyLabel(period).toLowerCase()

  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: '4px',
      }}>
        Activity snapshot
      </div>
      <p style={{
        fontSize: '12px',
        color: 'var(--text-muted)',
        lineHeight: 1.5,
        marginBottom: '10px',
      }}>
        Showing {periodLabel} — matches the grade window above.
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: '10px',
      }}>
        <StatCard
          isMobile={isMobile}
          label="Total repos"
          value={props.totalRepos.toString()}
          sub="all public on GitHub"
          tooltip="Total number of public repositories on the clawdbotatg GitHub account."
        />
        <StatCard
          isMobile={isMobile}
          label={window.commitsLabel}
          value={window.commits.toLocaleString()}
          sub={periodLabel}
          trend={window.showTrend ? formatStatTrend(window.commits, window.priorCommits, window.priorLabel) : undefined}
          tooltip="Commits across the sampled repo set for this window. Compared to the prior window of the same length."
          gated={gated}
        />
        <StatCard
          isMobile={isMobile}
          label={window.activeDaysLabel}
          value={window.activeDays.toString()}
          sub={periodLabel}
          trend={window.showTrend ? formatStatTrend(window.activeDays, window.priorActiveDays, window.priorLabel) : undefined}
          tooltip="Calendar days with at least one commit in the sampled repo set."
          gated={gated}
        />
        <StatCard
          isMobile={isMobile}
          label="Repos scored"
          value={pulse.reposScored.toString()}
          sub={`hand-scored · ${periodLabel}`}
          tooltip="Repos with rubric grades on this site (excludes awaiting-score placeholders)."
          gated={gated}
        />
        <StatCard
          isMobile={isMobile}
          label="Lifecycle"
          value={`${pulse.shipping} · ${pulse.stable}`}
          sub={pulse.done > 0 ? `${pulse.done} done · ${periodLabel}` : periodLabel}
          tooltip="How many scored repos had commits this window (shipping), were quiet (stable), or completed a supply-lock promise (done)."
          gated={gated}
        />
        <StatCard
          isMobile={isMobile}
          label="Last commit"
          value={props.lastCommitAt ? timeAgo(props.lastCommitAt) : '—'}
          sub={props.lastCommitRepo ?? ''}
          tooltip="Most recent commit found while scanning the sampled repo set."
          gated={gated}
        />
      </div>
    </div>
  )
}
