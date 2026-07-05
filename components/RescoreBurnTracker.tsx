'use client'

import InfoTooltip from '@/components/InfoTooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  APPROX_PENDING_LABEL,
  CLAWD_BURNED_TOOLTIP,
  ETH_PENDING_TOOLTIP,
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

  if (count <= 0 && clawdBurnedOnChain <= 0 && ethPendingInReceiver <= 0) return null

  const metaParts: string[] = []
  if (lastBurnLabel) metaParts.push(lastBurnLabel)

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

      {(metaParts.length > 0 || ethPendingInReceiver > 0) && (
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
          {metaParts.length > 0 && <span>{metaParts.join(' · ')}</span>}
          {metaParts.length > 0 && ethPendingInReceiver > 0 && <span>·</span>}
          {ethPendingInReceiver > 0 && (
            <>
              <span>{APPROX_PENDING_LABEL}</span>
              <InfoTooltip
                content={ETH_PENDING_TOOLTIP}
                ariaLabel="About approximate burn pending"
                icon="question"
                compact
                width={260}
              />
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: '6px', display: 'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
        <TriggerExecuteBurnButton ethPending={ethPendingInReceiver} compact />
      </div>
    </div>
  )
}
