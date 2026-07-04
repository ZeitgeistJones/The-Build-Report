'use client'

import { useState, useRef, useEffect } from 'react'
import { COLOR_THEMES, useColorTheme } from '@/components/ColorThemeProvider'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

export default function ColorThemePicker() {
  const { theme, setTheme } = useColorTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const current = COLOR_THEMES.find(t => t.id === theme)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Color theme"
        aria-expanded={open}
        title="Color theme"
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          padding: isMobile ? '8px 10px' : '4px 8px',
          minHeight: isMobile ? MIN_TAP : undefined,
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent)',
            flexShrink: 0,
          }}
        />
        {current?.label ?? 'Theme'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: '168px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '4px',
            zIndex: 50,
            boxShadow: 'var(--card-elevated)',
          }}
        >
          {COLOR_THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTheme(t.id)
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                color: theme === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                background: theme === t.id ? 'var(--accent-dim)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <ThemeSwatch themeId={t.id} />
              <span>
                <span style={{ display: 'block', fontWeight: 500 }}>{t.label}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ThemeSwatch({ themeId }: { themeId: string }) {
  const swatches: Record<string, string> = {
    teal: '#5FB3A1',
    lime: '#c8f060',
    warm: '#C4A882',
    slate: '#8BA4BC',
    light: '#5FB3A1',
  }
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: swatches[themeId] ?? '#888',
        flexShrink: 0,
        border: '1px solid var(--border)',
      }}
    />
  )
}
