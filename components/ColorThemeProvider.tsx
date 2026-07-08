'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  COLOR_THEME_STORAGE_KEY,
  CUSTOM_THEME_STORAGE_KEY,
  COLOR_THEMES,
  resolveColorThemeId,
  applyCustomTheme,
  type ColorThemeId,
  type CustomThemeVars,
} from '@/lib/colorThemes'

interface ColorThemeContextValue {
  theme: ColorThemeId
  setTheme: (theme: ColorThemeId) => void
  customVars: CustomThemeVars | null
  setCustomTheme: (vars: CustomThemeVars) => void
  clearCustomTheme: () => void
  isCustomActive: boolean
}

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null)

function applyPreset(theme: ColorThemeId) {
  const el = document.documentElement
  el.removeAttribute('style')
  el.dataset.colorTheme = theme
}

export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ColorThemeId>('light')
  const [customVars, setCustomVarsState] = useState<CustomThemeVars | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const storedCustom = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY)
    if (storedCustom) {
      try {
        const parsed = JSON.parse(storedCustom) as CustomThemeVars
        setCustomVarsState(parsed)
        applyCustomTheme(parsed)
        setReady(true)
        return
      } catch {
        localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY)
      }
    }
    const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY)
    const initial = resolveColorThemeId(stored)
    setThemeState(initial)
    applyPreset(initial)
    if (stored && stored !== initial) {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, initial)
    }
    setReady(true)
  }, [])

  function setTheme(next: ColorThemeId) {
    setThemeState(next)
    setCustomVarsState(null)
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, next)
    localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY)
    applyPreset(next)
  }

  function setCustomTheme(vars: CustomThemeVars) {
    setCustomVarsState(vars)
    localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(vars))
    // #region agent log
    try {
      applyCustomTheme(vars)
      const computedBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
      const inlineStyle = document.documentElement.getAttribute('style') || ''
      console.log('[custom-debug] setCustomTheme applied', { vars, computedBg, inlineStyleLen: inlineStyle.length, inlineStyleHead: inlineStyle.slice(0, 60), hasDataAttr: document.documentElement.hasAttribute('data-color-theme') })
    } catch (err) {
      console.log('[custom-debug] setCustomTheme THREW', { vars, err: String(err) })
    }
    // #endregion
  }

  function clearCustomTheme() {
    setCustomVarsState(null)
    localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY)
    applyPreset(theme)
  }

  if (!ready) return <>{children}</>

  return (
    <ColorThemeContext.Provider value={{
      theme,
      setTheme,
      customVars,
      setCustomTheme,
      clearCustomTheme,
      isCustomActive: customVars !== null,
    }}>
      {children}
    </ColorThemeContext.Provider>
  )
}

export function useColorTheme(): ColorThemeContextValue {
  const ctx = useContext(ColorThemeContext)
  if (!ctx) {
    return {
      theme: 'light',
      setTheme: () => {},
      customVars: null,
      setCustomTheme: () => {},
      clearCustomTheme: () => {},
      isCustomActive: false,
    }
  }
  return ctx
}

export { COLOR_THEMES }
