'use client'

import { useState } from 'react'
import {
  formatClawdAmount,
  formatEthAmount,
  formatLastBurnLabel,
} from '@/lib/clawdBurnIndex'
import TriggerExecuteBurnButton from '@/components/TriggerExecuteBurnButton'

const TOOLTIP =
  'Cumulative CLAWD sent to dead from execute() on the receiver contract — counted on-chain via Blockscout. Rescore payments deposit ETH until someone triggers a burn.'

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
  const [showTooltip, setShowTooltip] = useState(false)
  const lastBurnLabel = formatLastBurnLabel(lastBurnAt)

  if (count <= 0 && clawdBurnedOnChain <= 0 && ethPendingInReceiver <= 0) return null

  const metaParts: string[] = []
  if (lastBurnLabel) metaParts.push(lastBurnLabel)
  if (ethPendingInReceiver > 0) metaParts.push(`${formatEthAmount(ethPendingInReceiver)} ETH pending`)

  return (
    <div style={{ position: 'relative', textAlign: 'right' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: '5px',
          justifyContent: 'flex-end',
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
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(s => !s)}
          aria-label="About CLAWD burned total"
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--surface-3)',
            color: 'var(--text-muted)',
            fontSize: '9px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'default',
            padding: 0,
          }}
        >
          ⓘ
        </button>
      </div>

      {metaParts.length > 0 && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.4 }}>
          {metaParts.join(' · ')}
        </div>
      )}

      <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
        <TriggerExecuteBurnButton ethPending={ethPendingInReceiver} compact />
      </div>

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--surface-3)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            width: '240px',
            zIndex: 10,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {TOOLTIP}
        </div>
      )}
    </div>
  )
}
