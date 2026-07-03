'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { Period } from '@/lib/grades'

interface GradePeriodContextValue {
  period: Period
  setPeriod: (period: Period) => void
}

const GradePeriodContext = createContext<GradePeriodContextValue | null>(null)

export function GradePeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>('30d')
  return (
    <GradePeriodContext.Provider value={{ period, setPeriod }}>
      {children}
    </GradePeriodContext.Provider>
  )
}

export function useGradePeriod(): GradePeriodContextValue {
  const ctx = useContext(GradePeriodContext)
  if (!ctx) {
    throw new Error('useGradePeriod must be used within GradePeriodProvider')
  }
  return ctx
}

export function PeriodToggle() {
  const { period, setPeriod } = useGradePeriod()

  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        background: 'var(--surface-1)',
        borderRadius: '6px',
        padding: '3px',
      }}
    >
      {(['30d', '7d', '60d'] as const).map(p => (
        <button
          key={p}
          type="button"
          onClick={() => setPeriod(p)}
          style={{
            fontSize: '12px',
            padding: '4px 12px',
            borderRadius: '4px',
            background: period === p ? 'var(--accent-dim)' : 'transparent',
            color: period === p ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: period === p ? 500 : 400,
            border: period === p ? '1px solid var(--accent-border)' : '1px solid transparent',
            transition: 'all 0.15s',
          }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
