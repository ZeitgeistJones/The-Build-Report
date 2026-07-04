'use client'

import { useState } from 'react'
import { formatClawdAmount, formatEthAmount } from '@/lib/clawdBurnIndex'
import TriggerExecuteBurnButton from '@/components/TriggerExecuteBurnButton'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

const TOOLTIP =
  'Rescores send 0.000008 ETH to the receiver contract. CLAWD is only destroyed when someone calls execute() on that contract. Counts here are on-chain — not price estimates.'

interface Props {
  count: number
  ethPendingInReceiver: number
  clawdBurnedOnChain: number
}

export default function RescoreBurnTracker({
  count,
  ethPendingInReceiver,
  clawdBurnedOnChain,
}: Props) {
  const [showTooltip, setShowTooltip] = useState(false)
  const isMobile = useIsMobile()

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
        minWidth: isMobile ? undefined : '200px',
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
          Build Report · rescores
        </span>
        <span style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
          {count}
        </span>
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(s => !s)}
          aria-label="About rescore burns"
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

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45, textAlign: isMobile ? 'left' : 'right' }}>
        <div>
          <span style={{ color: '#f97316', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {formatClawdAmount(clawdBurnedOnChain)} CLAWD
          </span>
          {' '}burned on-chain
        </div>
        {ethPendingInReceiver > 0 && (
          <div>
            {formatEthAmount(ethPendingInReceiver)} ETH pending swap
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
