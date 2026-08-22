'use client'

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  applyCustomTheme,
  clearPersistedCustomTheme,
  persistCustomTheme,
  persistPresetTheme,
  readStoredColorTheme,
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
  const [theme, setThemeState] = useState<ColorThemeId>(DEFAULT_COLOR_THEME)
  const [customVars, setCustomVarsState] = useState<CustomThemeVars | null>(null)
  const userChose = useRef(false)

  useLayoutEffect(() => {
    if (userChose.current) return
    const stored = readStoredColorTheme()
    setThemeState(stored.theme)
    setCustomVarsState(stored.customVars)
    if (stored.customVars) {
      applyCustomTheme(stored.customVars)
      persistCustomTheme(stored.customVars)
      return
    }
    applyPreset(stored.theme)
    if (stored.hadStored) persistPresetTheme(stored.theme)
  }, [])

  function setTheme(next: ColorThemeId) {
    userChose.current = true
    setThemeState(next)
    setCustomVarsState(null)
    persistPresetTheme(next)
    applyPreset(next)
  }

  function setCustomTheme(vars: CustomThemeVars) {
    userChose.current = true
    setCustomVarsState(vars)
    persistCustomTheme(vars)
    applyCustomTheme(vars)
  }

  function clearCustomTheme() {
    userChose.current = true
    setCustomVarsState(null)
    clearPersistedCustomTheme()
    persistPresetTheme(theme)
    applyPreset(theme)
  }

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
      theme: DEFAULT_COLOR_THEME,
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
