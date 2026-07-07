'use client'

import { useState, useRef, useEffect } from 'react'
import {
  COLOR_THEME_GROUPS,
  getColorThemeMeta,
  type ColorThemeMeta,
} from '@/lib/colorThemes'
import { useColorTheme } from '@/components/ColorThemeProvider'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

export default function ColorThemePicker({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useColorTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const current = getColorThemeMeta(theme)

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
          gap: '6px',
          cursor: 'pointer',
        }}
      >
        <ThemeSwatch meta={current} size={compact ? 14 : 12} />
        {!compact && (current?.label ?? 'Theme')}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '220px',
            maxHeight: 'min(70vh, 400px)',
            overflowY: 'auto',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '6px',
            zIndex: 50,
            boxShadow: 'var(--card-elevated)',
          }}
        >
          {COLOR_THEME_GROUPS.map((group, groupIndex) => (
            <div key={group.label} style={{ marginTop: groupIndex > 0 ? '8px' : 0 }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  padding: '4px 8px 6px',
                }}
              >
                {group.label}
              </div>
              {group.themes.map(t => (
                <ThemeOption
                  key={t.id}
                  meta={t}
                  active={theme === t.id}
                  onSelect={() => {
                    setTheme(t.id)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ThemeOption({
  meta,
  active,
  onSelect,
}: {
  meta: ColorThemeMeta
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        textAlign: 'left',
        padding: '7px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        background: active ? 'var(--accent-dim)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      <ThemeSwatch meta={meta} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 500 }}>{meta.label}</span>
        <span
          style={{
            display: 'block',
            fontSize: '10px',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta.hint}
        </span>
      </span>
    </button>
  )
}

function ThemeSwatch({ meta, size = 16 }: { meta: ColorThemeMeta; size?: number }) {
  const dot = Math.max(5, Math.round(size * 0.38))
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '4px',
        background: meta.swatchBg,
        flexShrink: 0,
        border: '1px solid var(--border)',
        position: 'relative',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: meta.swatchAccent,
          border: '1.5px solid var(--surface-2)',
        }}
      />
    </span>
  )
}
