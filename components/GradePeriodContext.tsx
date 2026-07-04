'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { PeriodKey, PERIOD_TOGGLE_OPTIONS, REPO_WINDOW_OPTIONS } from '@/lib/grades'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

interface GradePeriodContextValue {
  period: PeriodKey
  setPeriod: (period: PeriodKey) => void
}

const GradePeriodContext = createContext<GradePeriodContextValue | null>(null)

export function GradePeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<PeriodKey>('30d')
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

interface PeriodOption<K extends PeriodKey = PeriodKey> {
  key: K
  label: string
  short: string
}

interface PeriodKeyToggleProps<K extends PeriodKey = PeriodKey> {
  period: K
  onChange: (period: K) => void
  /** When true, buttons stretch on mobile. Default false for inline repo controls. */
  stretchMobile?: boolean
  options?: readonly PeriodOption<K>[]
}

export function PeriodKeyToggle<K extends PeriodKey = PeriodKey>({
  period,
  onChange,
  stretchMobile = false,
  options = PERIOD_TOGGLE_OPTIONS as readonly PeriodOption<K>[],
}: PeriodKeyToggleProps<K>) {
  const isMobile = useIsMobile()

  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        background: 'var(--surface-1)',
        borderRadius: '6px',
        padding: '3px',
        flexWrap: 'wrap',
        justifyContent: stretchMobile && isMobile ? 'stretch' : 'flex-start',
      }}
    >
      {options.map(({ key, label, short }) => (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onChange(key)}
          style={{
            fontSize: '11px',
            padding: isMobile ? '8px 10px' : '4px 10px',
            minHeight: isMobile ? MIN_TAP : undefined,
            borderRadius: '4px',
            background: period === key ? 'var(--accent-dim)' : 'transparent',
            color: period === key ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: period === key ? 500 : 400,
            border: period === key ? '1px solid var(--accent-border)' : '1px solid transparent',
            transition: 'all 0.15s',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: stretchMobile && isMobile ? '1 1 auto' : undefined,
            whiteSpace: 'nowrap',
          }}
        >
          {short}
        </button>
      ))}
    </div>
  )
}

export { REPO_WINDOW_OPTIONS }

export function PeriodToggle() {
  const { period, setPeriod } = useGradePeriod()
  return <PeriodKeyToggle period={period} onChange={setPeriod} stretchMobile />
}
