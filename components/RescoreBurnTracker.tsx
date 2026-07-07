'use client'

import InfoTooltip from '@/components/InfoTooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  BURN_TRACKER_TOOLTIP,
  formatEthPendingLabel,
} from '@/lib/burnTrackerCopy'
import {
  formatClawdAmount,
  formatLastBurnLabel,
} from '@/lib/clawdBurnIndex'
import TriggerExecuteBurnButton from '@/components/TriggerExecuteBurnButton'

interface Props {
  count: number
  ethPendingInReceiver: number
  clawdBurnedOnChain: number
  lastBurnAt: string | null
}

export default function RescoreBurnTracker({
  count,
  ethPendingInReceiver,
  clawdBurnedOnChain,
  lastBurnAt,
}: Props) {
  const isMobile = useIsMobile()
  const lastBurnLabel = formatLastBurnLabel(lastBurnAt)
  const ethPendingLabel = formatEthPendingLabel(ethPendingInReceiver)
  const showMeta = count > 0 || Boolean(lastBurnLabel) || Boolean(ethPendingLabel)

  if (count <= 0 && clawdBurnedOnChain <= 0 && ethPendingInReceiver <= 0) return null

  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        minWidth: isMobile ? undefined : '220px',
        maxWidth: isMobile ? undefined : '260px',
        boxShadow: 'var(--card-elevated)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          paddingBottom: showMeta ? '8px' : 0,
          borderBottom: showMeta ? '1px solid var(--border)' : undefined,
          marginBottom: showMeta ? '8px' : 0,
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
          ariaLabel="About CLAWD burned, rescores, and ETH queued"
          compact
          width={280}
        />
      </div>

      {showMeta && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
            marginBottom: '10px',
          }}
        >
          {count > 0 && (
            <div>
              {count.toLocaleString('en-US')} rescore{count === 1 ? '' : 's'} funded
            </div>
          )}
          {lastBurnLabel && <div>Last burn · {lastBurnLabel}</div>}
          {ethPendingLabel && <div>{ethPendingLabel}</div>}
        </div>
      )}

      <TriggerExecuteBurnButton
        ethPending={ethPendingInReceiver}
        compact
        fullWidth={isMobile}
      />
    </div>
  )
}
