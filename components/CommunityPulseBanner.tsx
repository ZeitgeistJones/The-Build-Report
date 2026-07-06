'use client'

import type { CommunityPulse } from '@/lib/communityContextTypes'
import { communityPulseMessage } from '@/lib/communityContext'

interface Props {
  pulse: CommunityPulse
  onReview: () => void
}

export default function CommunityPulseBanner({ pulse, onReview }: Props) {
  if (pulse.repoCount <= 0) return null

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '12px 16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '4px',
          }}
        >
          Community activity
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {communityPulseMessage(pulse)}
        </p>
      </div>
      <button
        type="button"
        onClick={onReview}
        style={{
          fontSize: '13px',
          color: 'var(--accent)',
          background: 'var(--accent-dim)',
          border: '1px solid var(--accent-border)',
          borderRadius: 'var(--radius)',
          padding: '8px 14px',
          cursor: 'pointer',
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        Review community context →
      </button>
    </div>
  )
}
