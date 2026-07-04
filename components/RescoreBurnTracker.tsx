'use client'

import { useState } from 'react'
import {
  formatClawdCompact,
  formatEthAmount,
  formatLastBurnLabel,
} from '@/lib/clawdBurnIndex'
import TriggerExecuteBurnButton from '@/components/TriggerExecuteBurnButton'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

const TOOLTIP =
  'Cumulative CLAWD sent to dead from execute() on the receiver contract — counted via Blockscout (CLAWD→dead transfers where tx.to is the receiver). Rescore payments only deposit ETH until someone triggers a burn.'

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
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        gap: '6px',
        flexShrink: 0,
        minWidth: isMobile ? undefined : '220px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          CLAWD burned
        </span>
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(s => !s)}
          aria-label="About CLAWD burns"
          style={{
            width: isMobile ? MIN_TAP : 14,
            height: isMobile ? MIN_TAP : 14,
            borderRadius: '50%',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '11px',
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
          fontSize: '22px',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          color: '#f97316',
          lineHeight: 1.1,
          textAlign: isMobile ? 'left' : 'right',
        }}
      >
        {formatClawdCompact(clawdBurnedOnChain)} CLAWD
      </div>

      {lastBurnLabel && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: isMobile ? 'left' : 'right' }}>
          last burn {lastBurnLabel}
        </div>
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45, textAlign: isMobile ? 'left' : 'right' }}>
        {count > 0 && (
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{count}</span>
            {' '}rescore{count === 1 ? '' : 's'}
          </div>
        )}
        {ethPendingInReceiver > 0 && (
          <div>
            {formatEthAmount(ethPendingInReceiver)} ETH waiting to burn
          </div>
        )}
      </div>

      <TriggerExecuteBurnButton ethPending={ethPendingInReceiver} compact />

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
            width: isMobile ? 'min(280px, calc(100vw - 32px))' : '280px',
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
