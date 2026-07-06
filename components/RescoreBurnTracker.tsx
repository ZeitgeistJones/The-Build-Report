'use client'

import InfoTooltip from '@/components/InfoTooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  CLAWD_BURNED_TOOLTIP,
  ETH_PENDING_TOOLTIP,
  formatEthPendingLabel,
  RESCORE_COUNT_TOOLTIP,
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
    <div style={{ textAlign: isMobile ? 'left' : 'right', maxWidth: isMobile ? undefined : '200px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: '5px',
          justifyContent: isMobile ? 'flex-start' : 'flex-end',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatClawdAmount(clawdBurnedOnChain)} CLAWD
        </span>
        <InfoTooltip
          content={CLAWD_BURNED_TOOLTIP}
          ariaLabel="About CLAWD burned total"
          compact
          width={240}
        />
      </div>

      {showMeta && (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            marginTop: '3px',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'flex-end',
            gap: '4px',
            flexWrap: 'wrap',
          }}
        >
          {count > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>
                {count.toLocaleString('en-US')} rescore{count === 1 ? '' : 's'} funded
              </span>
              <InfoTooltip
                content={RESCORE_COUNT_TOOLTIP}
                ariaLabel="About rescore count"
                icon="question"
                compact
                width={240}
              />
            </span>
          )}
          {count > 0 && (lastBurnLabel || ethPendingLabel) && <span aria-hidden>·</span>}
          {lastBurnLabel && <span>{lastBurnLabel}</span>}
          {lastBurnLabel && ethPendingLabel && <span aria-hidden>·</span>}
          {ethPendingLabel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>{ethPendingLabel}</span>
              <InfoTooltip
                content={ETH_PENDING_TOOLTIP}
                ariaLabel="About ETH queued for burn"
                icon="question"
                compact
                width={260}
              />
            </span>
          )}
        </div>
      )}

      <div style={{ marginTop: '6px', display: 'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
        <TriggerExecuteBurnButton ethPending={ethPendingInReceiver} compact />
      </div>
    </div>
  )
}
