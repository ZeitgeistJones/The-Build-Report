'use client'

import InfoTooltip from '@/components/InfoTooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import { BURN_TRACKER_TOOLTIP } from '@/lib/burnTrackerCopy'
import {
  formatClawdAmount,
  formatLastBurnLabel,
} from '@/lib/clawdBurnIndex'

interface Props {
  count: number
  ethPendingInReceiver: number
  clawdBurnedOnChain: number
  lastBurnAt: string | null
}

/** Public header burn stat — CLAWD burned only (no funded-rescore / execute chrome). */
export default function RescoreBurnTracker({
  clawdBurnedOnChain,
  lastBurnAt,
}: Props) {
  const isMobile = useIsMobile()
  const lastBurnLabel = formatLastBurnLabel(lastBurnAt)

  if (clawdBurnedOnChain <= 0 && !lastBurnLabel) return null

  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        minWidth: isMobile ? undefined : '200px',
        maxWidth: isMobile ? undefined : '240px',
        boxShadow: 'var(--card-elevated)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          paddingBottom: lastBurnLabel ? '8px' : 0,
          borderBottom: lastBurnLabel ? '1px solid var(--border)' : undefined,
          marginBottom: lastBurnLabel ? '8px' : 0,
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.3,
          }}
        >
          {formatClawdAmount(clawdBurnedOnChain)} CLAWD burned
        </span>
        <InfoTooltip
          content={BURN_TRACKER_TOOLTIP}
          ariaLabel="About CLAWD burned"
          compact
          width={280}
        />
      </div>

      {lastBurnLabel && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
          }}
        >
          Last burn · {lastBurnLabel}
        </div>
      )}
    </div>
  )
}
