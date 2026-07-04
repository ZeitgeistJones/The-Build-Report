'use client'

import { useState } from 'react'
import {
  formatClawdAmount,
  formatEthAmount,
  formatLastBurnLabel,
} from '@/lib/clawdBurnIndex'
import TriggerExecuteBurnButton from '@/components/TriggerExecuteBurnButton'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

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
  const isMobile = useIsMobile()
  const lastBurnLabel = formatLastBurnLabel(lastBurnAt)

  if (count <= 0 && clawdBurnedOnChain <= 0 && ethPendingInReceiver <= 0) return null

  return (
    <div
      style={{
        position: 'relative',
        flexShrink: 0,
        textAlign: isMobile ? 'left' : 'right',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        gap: '6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'flex-start' : 'flex-end',
          gap: '5px',
          marginBottom: '2px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          CLAWD BURNED 🔥
        </div>
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(s => !s)}
          aria-label="About CLAWD burned total"
          style={{
            width: isMobile ? MIN_TAP : 14,
            height: isMobile ? MIN_TAP : 14,
            borderRadius: '50%',
            background: 'var(--surface-3)',
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
          ⓘ
        </button>
      </div>

      <div
        style={{
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--accent)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {formatClawdAmount(clawdBurnedOnChain)}
      </div>

      {ethPendingInReceiver > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {formatEthAmount(ethPendingInReceiver)} ETH pending swap
        </div>
      )}

      <TriggerExecuteBurnButton ethPending={ethPendingInReceiver} compact />

      {lastBurnLabel && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          last burn {lastBurnLabel}
        </div>
      )}

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(isMobile ? { left: 0 } : { right: 0 }),
            background: 'var(--surface-3)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            width: isMobile ? 'min(280px, calc(100vw - 32px))' : '260px',
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
