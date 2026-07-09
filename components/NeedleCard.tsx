'use client'

import type { NeedleData } from '@/lib/needle'
import { useNormieMode } from '@/components/NormieModeProvider'

interface Props {
  needle: NeedleData | null
}

export default function NeedleCard({ needle }: Props) {
  const { normie } = useNormieMode()

  if (!needle) return null
  const text = (normie && needle.textNormie) || needle.text
  if (!text) return null

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '14px 16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          The Needle
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {needle.repoCount} repo{needle.repoCount === 1 ? '' : 's'} moved
        </span>
      </div>

      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        {text}
      </p>
    </div>
  )
}
