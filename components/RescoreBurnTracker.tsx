'use client'

import { useState } from 'react'
import { formatClawdBurned } from '@/lib/rescoreBurns'

const TOOLTIP =
  'Approximate — calculated at time of each rescore using CoinGecko ETH/CLAWD prices. Actual amount may vary slightly due to swap fees and price movement.'

interface Props {
  clawdTotal: number
}

export default function RescoreBurnTracker({ clawdTotal }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (clawdTotal <= 0) return null

  return (
    <div style={{ position: 'relative', flexShrink: 0, textAlign: 'right' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', marginBottom: '4px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          CLAWD BURNED 🔥
        </div>
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
            background: 'var(--surface-3)',
            color: 'var(--text-muted)',
            fontSize: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'default',
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
        {formatClawdBurned(clawdTotal)}
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
