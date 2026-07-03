'use client'

import { useState } from 'react'
import { formatClawdBurned } from '@/lib/rescoreBurns'

const TOOLTIP =
  'Approximate — calculated at time of each rescore using CoinGecko ETH/CLAWD prices. Actual amount may vary slightly due to swap fees and price movement. Falls back to cached or estimated rates if live prices are unavailable.'

interface Props {
  count: number
  clawdDisplay: number
}

export default function RescoreBurnTracker({ count, clawdDisplay }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (count <= 0 && clawdDisplay <= 0) return null

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        CLAWD BURNED 🔥
      </span>
      <span
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#f97316',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '-0.02em',
        }}
      >
        {formatClawdBurned(clawdDisplay)}
      </span>
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(s => !s)}
        aria-label="About CLAWD burned total"
        style={{
          width: '14px',
          height: '14px',
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
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            background: 'var(--surface-3)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '8px 10px',
            fontSize: '12px',
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
