'use client'

import { useState, useRef, useEffect } from 'react'
import {
  COLOR_THEME_GROUPS,
  getColorThemeMeta,
  type ColorThemeMeta,
  type CustomThemeVars,
} from '@/lib/colorThemes'
import { useColorTheme } from '@/components/ColorThemeProvider'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

export default function ColorThemePicker({ compact }: { compact?: boolean }) {
  const { theme, setTheme, customVars, setCustomTheme, clearCustomTheme, isCustomActive } = useColorTheme()
  const [open, setOpen] = useState(false)
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const current = getColorThemeMeta(theme)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const outside = ref.current ? !ref.current.contains(e.target as Node) : true
      // #region agent log
      const tgt = e.target as HTMLElement | null
      console.log('[custom-debug] doc mousedown', { outside, targetTag: tgt?.tagName, targetType: (tgt as HTMLInputElement | null)?.type, targetId: tgt?.id })
      // #endregion
      if (outside) {
        setOpen(false)
        setShowCustomPanel(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const triggerLabel = isCustomActive ? 'Custom' : (current?.label ?? 'Theme')
  const triggerSwatchBg = isCustomActive ? (customVars?.bg ?? '#FAFAFA') : (current?.swatchBg ?? '#FAFAFA')
  const triggerSwatchAccent = isCustomActive ? (customVars?.accent ?? '#3D9A88') : (current?.swatchAccent ?? '#3D9A88')

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
        <RawSwatch bg={triggerSwatchBg} accent={triggerSwatchAccent} size={compact ? 14 : 12} />
        {!compact && triggerLabel}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '220px',
            maxHeight: 'min(70vh, 480px)',
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
                  active={!isCustomActive && theme === t.id}
                  onSelect={() => {
                    setTheme(t.id)
                    setShowCustomPanel(false)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          ))}

          {/* Custom section */}
          <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
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
              Custom
            </div>
            <button
              type="button"
              onClick={() => {
                // #region agent log
                console.log('[custom-debug] Customize button clicked', { willShow: !showCustomPanel })
                // #endregion
                setShowCustomPanel(p => !p)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                textAlign: 'left',
                padding: '7px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                color: isCustomActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isCustomActive ? 'var(--accent-dim)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <RawSwatch
                bg={customVars?.bg ?? '#FAFAFA'}
                accent={customVars?.accent ?? '#3D9A88'}
                size={16}
                checkerboard={!isCustomActive}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>
                  {isCustomActive ? 'Custom (active)' : 'Customize...'}
                </span>
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>
                  {isCustomActive ? `${customVars?.bg} · ${customVars?.accent}` : 'Set your own colors'}
                </span>
              </span>
            </button>

            {showCustomPanel && (
              <CustomPanel
                initial={customVars ?? { bg: '#FAFAFA', accent: '#3D9A88', base: 'light' }}
                onChange={setCustomTheme}
                onReset={() => {
                  clearCustomTheme()
                  setShowCustomPanel(false)
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CustomPanel({
  initial,
  onChange,
  onReset,
}: {
  initial: CustomThemeVars
  onChange: (v: CustomThemeVars) => void
  onReset: () => void
}) {
  const [bg, setBg] = useState(initial.bg)
  const [accent, setAccent] = useState(initial.accent)
  const [base, setBase] = useState<'light' | 'dark'>(initial.base)

  function update(next: Partial<CustomThemeVars>) {
    const merged = { bg, accent, base, ...next }
    // #region agent log
    console.log('[custom-debug] CustomPanel update', { next, merged })
    // #endregion
    if (next.bg !== undefined) setBg(next.bg)
    if (next.accent !== undefined) setAccent(next.accent)
    if (next.base !== undefined) setBase(next.base)
    onChange(merged)
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 8px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    gap: '8px',
  }

  return (
    <div
      style={{
        margin: '4px 0 2px',
        padding: '8px 4px 6px',
        borderRadius: '6px',
        background: 'var(--surface-3)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={rowStyle}>
        <label htmlFor="custom-bg" style={{ flexShrink: 0 }}>Background</label>
        <input
          id="custom-bg"
          type="color"
          value={bg}
          onChange={e => update({ bg: e.target.value })}
          style={{ width: 32, height: 22, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="custom-accent" style={{ flexShrink: 0 }}>Accent</label>
        <input
          id="custom-accent"
          type="color"
          value={accent}
          onChange={e => update({ accent: e.target.value })}
          style={{ width: 32, height: 22, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
        />
      </div>
      <div style={rowStyle}>
        <span style={{ flexShrink: 0 }}>Text</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['light', 'dark'] as const).map(b => (
            <button
              key={b}
              type="button"
              onClick={() => update({ base: b })}
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border)',
                background: base === b ? 'var(--accent)' : 'var(--surface-1)',
                color: base === b ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: base === b ? 600 : 400,
              }}
            >
              {b === 'light' ? 'Dark text' : 'Light text'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '4px 8px 0', textAlign: 'right' }}>
        <button
          type="button"
          onClick={onReset}
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            textDecoration: 'underline',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: 0,
          }}
        >
          Reset to default
        </button>
      </div>
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

function RawSwatch({
  bg,
  accent,
  size = 16,
  checkerboard = false,
}: {
  bg: string
  accent: string
  size?: number
  checkerboard?: boolean
}) {
  const dot = Math.max(5, Math.round(size * 0.38))
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '4px',
        background: checkerboard
          ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 8px 8px'
          : bg,
        flexShrink: 0,
        border: '1px solid var(--border)',
        position: 'relative',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      {!checkerboard && (
        <span
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: '50%',
            background: accent,
            border: '1.5px solid var(--surface-2)',
          }}
        />
      )}
    </span>
  )
}

function ThemeSwatch({ meta, size = 16 }: { meta: ColorThemeMeta; size?: number }) {
  return <RawSwatch bg={meta.swatchBg} accent={meta.swatchAccent} size={size} />
}
