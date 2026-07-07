'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  COLOR_THEME_STORAGE_KEY,
  COLOR_THEMES,
  resolveColorThemeId,
  type ColorThemeId,
} from '@/lib/colorThemes'

interface ColorThemeContextValue {
  theme: ColorThemeId
  setTheme: (theme: ColorThemeId) => void
}

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null)

function applyTheme(theme: ColorThemeId) {
  document.documentElement.dataset.colorTheme = theme
}

export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ColorThemeId>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY)
    const initial = resolveColorThemeId(stored)
    setThemeState(initial)
    applyTheme(initial)
    if (stored && stored !== initial) {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, initial)
    }
    setReady(true)
  }, [])

  function setTheme(next: ColorThemeId) {
    setThemeState(next)
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, next)
    applyTheme(next)
  }

  if (!ready) return <>{children}</>

  return (
    <ColorThemeContext.Provider value={{ theme, setTheme }}>
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
    }
  }
  return ctx
}

export { COLOR_THEMES }
