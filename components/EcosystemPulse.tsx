'use client'

import { useGradePeriod } from './GradePeriodContext'
import { EcosystemPulse } from '@/lib/ecosystemPulse'

interface Props {
  pulse30: EcosystemPulse
  pulse7: EcosystemPulse
  pulse60: EcosystemPulse
  commits?: number
}

export function PulseMicrostats({ pulse30, pulse7, pulse60, commits }: Props) {
  const { period } = useGradePeriod()
  const pulse = period === '30d' ? pulse30 : period === '7d' ? pulse7 : pulse60

  const parts = [
    `${pulse.reposScored} scored`,
    `${pulse.shipping} shipping`,
    `${pulse.stable} stable`,
  ]
  if (commits != null) parts.push(`${commits} commits`)

  return (
    <span
      style={{
        fontSize: '12px',
        color: 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {parts.join(' · ')}
    </span>
  )
}
