'use client'

import { useNormieMode } from '@/components/NormieModeProvider'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

export default function NormieToggle({ compact }: { compact?: boolean }) {
  const { normie, toggleNormie } = useNormieMode()
  const isMobile = useIsMobile()

  function handleClick() {
    toggleNormie()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      role="switch"
      aria-checked={normie}
      aria-label="Plain English mode"
      title={normie ? 'Plain English: on' : 'Plain English: off'}
      style={{
        fontSize: '11px',
        color: normie ? 'var(--accent)' : 'var(--text-muted)',
        padding: isMobile ? '8px 10px' : '4px 8px',
        minHeight: isMobile ? MIN_TAP : undefined,
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${normie ? 'var(--accent-border)' : 'var(--border)'}`,
        background: normie ? 'var(--accent-dim)' : 'var(--surface-1)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        fontWeight: normie ? 600 : 400,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: compact ? 14 : 12,
          height: compact ? 14 : 12,
          borderRadius: '50%',
          border: `1px solid ${normie ? 'var(--accent)' : 'var(--border-strong)'}`,
          background: normie ? 'var(--accent)' : 'transparent',
          flexShrink: 0,
        }}
      />
      Plain English
    </button>
  )
}
