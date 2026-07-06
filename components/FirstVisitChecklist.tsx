'use client'

import { useEffect, useState } from 'react'
import { START_HERE_CHECKLIST } from '@/lib/startHereContent'

const STORAGE_KEY = 'tbr-first-visit-checklist'

type ChecklistState = {
  checked: boolean[]
  dismissed: boolean
}

function loadState(): ChecklistState {
  if (typeof window === 'undefined') {
    return { checked: [false, false, false], dismissed: false }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { checked: [false, false, false], dismissed: false }
    const parsed = JSON.parse(raw) as ChecklistState
    return {
      checked: [
        Boolean(parsed.checked?.[0]),
        Boolean(parsed.checked?.[1]),
        Boolean(parsed.checked?.[2]),
      ],
      dismissed: Boolean(parsed.dismissed),
    }
  } catch {
    return { checked: [false, false, false], dismissed: false }
  }
}

function saveState(state: ChecklistState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

export default function FirstVisitChecklist() {
  const [state, setState] = useState<ChecklistState | null>(null)

  useEffect(() => {
    setState(loadState())
  }, [])

  if (!state) return null
  if (state.dismissed) return null
  if (state.checked.every(Boolean)) return null

  function toggle(index: number) {
    setState(prev => {
      if (!prev) return prev
      const checked = [...prev.checked]
      checked[index] = !checked[index]
      const next = { ...prev, checked }
      saveState(next)
      return next
    })
  }

  function dismiss() {
    setState(prev => {
      if (!prev) return prev
      const next = { ...prev, dismissed: true }
      saveState(next)
      return next
    })
  }

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '14px 16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {START_HERE_CHECKLIST.intro}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss checklist"
          style={{
            flexShrink: 0,
            fontSize: '11px',
            color: 'var(--text-muted)',
            padding: '2px 4px',
          }}
        >
          Dismiss
        </button>
      </div>
      <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {START_HERE_CHECKLIST.items.map((label, i) => (
          <li key={label}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={state.checked[i]}
                onChange={() => toggle(i)}
                style={{ marginTop: '3px', flexShrink: 0 }}
              />
              <span>{label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
