'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export const NORMIE_MODE_STORAGE_KEY = 'build-report-normie-mode'

interface NormieModeContextValue {
  normie: boolean
  setNormie: (on: boolean) => void
  toggleNormie: () => void
}

const NormieModeContext = createContext<NormieModeContextValue | null>(null)

function applyNormieAttr(on: boolean) {
  if (on) {
    document.documentElement.dataset.normie = '1'
  } else {
    delete document.documentElement.dataset.normie
  }
}

export function NormieModeProvider({ children }: { children: ReactNode }) {
  const [normie, setNormieState] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(NORMIE_MODE_STORAGE_KEY)
    const on = stored === '1'
    setNormieState(on)
    applyNormieAttr(on)
  }, [])

  function setNormie(on: boolean) {
    setNormieState(on)
    localStorage.setItem(NORMIE_MODE_STORAGE_KEY, on ? '1' : '0')
    applyNormieAttr(on)
  }

  return (
    <NormieModeContext.Provider value={{ normie, setNormie, toggleNormie: () => setNormie(!normie) }}>
      {children}
    </NormieModeContext.Provider>
  )
}

export function useNormieMode(): NormieModeContextValue {
  const ctx = useContext(NormieModeContext)
  if (!ctx) {
    return { normie: false, setNormie: () => {}, toggleNormie: () => {} }
  }
  return ctx
}
