'use client'

import { useNormieMode } from '@/components/NormieModeProvider'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

export default function NormieToggle({ compact, header }: { compact?: boolean; header?: boolean }) {
  const { normie, toggleNormie } = useNormieMode()
  const isMobile = useIsMobile()
  const showLabel = !header

  function handleClick() {
    toggleNormie()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      role="switch"
      aria-checked={normie}
      aria-label="Plain English mode — rewrite verdicts and digests without jargon"
      title="Rewrites verdicts, grade blurbs, and digests in plain English — same facts, no jargon. Toggle off for the original technical wording."
      style={{
        fontSize: header ? '10px' : '11px',
        color: normie ? 'var(--accent)' : 'var(--text-muted)',
        padding: header ? '6px 8px' : isMobile ? '8px 10px' : '4px 8px',
        minHeight: isMobile || header ? MIN_TAP : undefined,
        minWidth: header ? MIN_TAP : undefined,
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${normie ? 'var(--accent-border)' : 'var(--border)'}`,
        background: normie ? 'var(--accent-dim)' : 'var(--surface-1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: header ? '4px' : '6px',
        cursor: 'pointer',
        fontWeight: normie ? 600 : 400,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: compact || header ? 12 : 12,
          height: compact || header ? 12 : 12,
          borderRadius: '50%',
          border: `1px solid ${normie ? 'var(--accent)' : 'var(--border-strong)'}`,
          background: normie ? 'var(--accent)' : 'transparent',
          flexShrink: 0,
        }}
      />
      {showLabel && 'Plain English'}
      {header && <span aria-hidden>Plain</span>}
    </button>
  )
}
