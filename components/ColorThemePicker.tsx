'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  COLOR_THEME_GROUPS,
  getColorThemeMeta,
  type ColorThemeId,
  type ColorThemeMeta,
  type CustomThemeVars,
} from '@/lib/colorThemes'
import { useColorTheme } from '@/components/ColorThemeProvider'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

function closeThemePicker(
  setOpen: (v: boolean) => void,
  setShowCustomPanel: (v: boolean) => void,
) {
  setOpen(false)
  setShowCustomPanel(false)
}

export default function ColorThemePicker({ compact, header }: { compact?: boolean; header?: boolean }) {
  const { theme, setTheme, customVars, setCustomTheme, clearCustomTheme, isCustomActive } = useColorTheme()
  const [open, setOpen] = useState(false)
  const [showCustomPanel, setShowCustomPanel] = useState(false)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const current = getColorThemeMeta(theme)
  const swatchOnly = compact || header

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !isMobile) return
    const scrollY = window.scrollY
    document.body.classList.add('scroll-lock')
    document.body.style.top = `-${scrollY}px`
    return () => {
      document.body.classList.remove('scroll-lock')
      document.body.style.top = ''
      window.scrollTo(0, scrollY)
    }
  }, [open, isMobile])

  useEffect(() => {
    if (!open || isMobile) return
    function onDocClick(e: MouseEvent) {
      const outside = ref.current ? !ref.current.contains(e.target as Node) : true
      if (outside) closeThemePicker(setOpen, setShowCustomPanel)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, isMobile])

  useEffect(() => {
    if (!showCustomPanel) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [showCustomPanel])

  const triggerLabel = isCustomActive ? 'Custom' : (current?.label ?? 'Theme')
  const triggerSwatchBg = isCustomActive ? (customVars?.bg ?? '#FAFAFA') : (current?.swatchBg ?? '#FAFAFA')
  const triggerSwatchAccent = isCustomActive ? (customVars?.accent ?? '#3D9A88') : (current?.swatchAccent ?? '#3D9A88')

  function handleSelectTheme(id: Parameters<typeof setTheme>[0]) {
    setTheme(id)
    closeThemePicker(setOpen, setShowCustomPanel)
  }

  const panel = (
    <ThemePickerPanel
      theme={theme}
      isCustomActive={isCustomActive}
      customVars={customVars}
      showCustomPanel={showCustomPanel}
      isMobile={isMobile}
      onSelectTheme={handleSelectTheme}
      onToggleCustomPanel={() => setShowCustomPanel(p => !p)}
      onCustomChange={setCustomTheme}
      onCustomReset={() => {
        clearCustomTheme()
        setShowCustomPanel(false)
      }}
    />
  )

  const mobileSheet =
    open && isMobile && mounted
      ? createPortal(
          <>
            <div
              role="presentation"
              onClick={() => closeThemePicker(setOpen, setShowCustomPanel)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.45)',
                zIndex: 100,
              }}
            />
            <div
              role="dialog"
              aria-label="Color theme"
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: 'min(85vh, 640px)',
                background: 'var(--surface-2)',
                borderTop: '1px solid var(--border-strong)',
                borderRadius: '16px 16px 0 0',
                zIndex: 101,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.35)',
                paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px 8px',
                  borderBottom: '1px solid var(--border)',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Theme</span>
                <button
                  type="button"
                  onClick={() => closeThemePicker(setOpen, setShowCustomPanel)}
                  aria-label="Close theme picker"
                  style={{
                    width: MIN_TAP,
                    height: MIN_TAP,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '18px',
                  }}
                >
                  ✕
                </button>
              </div>
              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                  padding: '6px 10px 8px',
                }}
              >
                {panel}
              </div>
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Color theme"
        aria-expanded={open}
        title="Color theme"
        style={{
          fontSize: header ? '10px' : '11px',
          color: 'var(--text-muted)',
          padding: header ? '6px 8px' : isMobile ? '8px 10px' : '4px 8px',
          minHeight: isMobile || header ? MIN_TAP : undefined,
          minWidth: header ? MIN_TAP : undefined,
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: header ? '4px' : '6px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <RawSwatch bg={triggerSwatchBg} accent={triggerSwatchAccent} size={header ? 14 : compact ? 14 : 12} />
        {!swatchOnly && triggerLabel}
      </button>

      {open && !isMobile && (
        <div
          ref={scrollRef}
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
          {panel}
        </div>
      )}

      {mobileSheet}
    </div>
  )
}

function ThemePickerPanel({
  theme,
  isCustomActive,
  customVars,
  showCustomPanel,
  isMobile,
  onSelectTheme,
  onToggleCustomPanel,
  onCustomChange,
  onCustomReset,
}: {
  theme: string
  isCustomActive: boolean
  customVars: CustomThemeVars | null
  showCustomPanel: boolean
  isMobile: boolean
  onSelectTheme: (id: ColorThemeId) => void
  onToggleCustomPanel: () => void
  onCustomChange: (v: CustomThemeVars) => void
  onCustomReset: () => void
}) {
  return (
    <>
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
              isMobile={isMobile}
              onSelect={() => onSelectTheme(t.id)}
            />
          ))}
        </div>
      ))}

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
          onClick={onToggleCustomPanel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            textAlign: 'left',
            padding: isMobile ? '10px 8px' : '7px 8px',
            minHeight: isMobile ? MIN_TAP : undefined,
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
            onChange={onCustomChange}
            onReset={onCustomReset}
          />
        )}
      </div>
    </>
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
  isMobile,
  onSelect,
}: {
  meta: ColorThemeMeta
  active: boolean
  isMobile: boolean
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
        padding: isMobile ? '10px 8px' : '7px 8px',
        minHeight: isMobile ? MIN_TAP : undefined,
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
