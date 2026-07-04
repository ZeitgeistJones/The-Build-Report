'use client'

import { useGradePeriod } from './GradePeriodContext'
import { periodKeyToBase } from '@/lib/grades'
import { EcosystemPulse, ecosystemPulseSummary } from '@/lib/ecosystemPulse'

interface Props {
  pulse30: EcosystemPulse
  pulse7: EcosystemPulse
  pulse60: EcosystemPulse
}

function PulseStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '56px' }}>
      <div
        style={{
          fontSize: '22px',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  )
}

export default function EcosystemPulsePanel({ pulse30, pulse7, pulse60 }: Props) {
  const { period: periodKey } = useGradePeriod()
  const period = periodKeyToBase(periodKey)
  const pulse = period === '30d' ? pulse30 : period === '7d' ? pulse7 : pulse60
  const summary = ecosystemPulseSummary(pulse, period)

  return (
    <div
      style={{
        marginBottom: '12px',
        padding: '16px 18px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '12px',
        }}
      >
        Ecosystem pulse
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px 20px',
          marginBottom: '12px',
          alignItems: 'flex-end',
        }}
      >
        <PulseStat label="scored" value={pulse.reposScored} />
        <PulseStat label="shipping" value={pulse.shipping} />
        <PulseStat label="stable" value={pulse.stable} />
        {pulse.done > 0 && <PulseStat label="done" value={pulse.done} />}
        <PulseStat label="burn apps" value={pulse.consumerApps} />
        <PulseStat label="infra/tools" value={pulse.infraTools} />
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        {summary}
      </p>
    </div>
  )
}
