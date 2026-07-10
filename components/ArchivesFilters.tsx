'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  ARCHIVE_PERIOD_OPTIONS,
  ARCHIVE_TYPE_OPTIONS,
  type ArchivePeriod,
  type ArchiveType,
} from '@/lib/archives'

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: '12px',
        padding: '5px 10px',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: active ? 500 : 400,
        border: active ? '1px solid var(--accent-border)' : '1px solid var(--border)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {label}
    </button>
  )
}

export default function ArchivesFilters({
  type,
  period,
}: {
  type: ArchiveType
  period: ArchivePeriod
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>Type</span>
        {ARCHIVE_TYPE_OPTIONS.map(opt => (
          <Pill
            key={opt.key}
            active={type === opt.key}
            label={opt.label}
            onClick={() => setParam('type', opt.key)}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>Period</span>
        {ARCHIVE_PERIOD_OPTIONS.map(opt => (
          <Pill
            key={opt.key}
            active={period === opt.key}
            label={opt.label}
            onClick={() => setParam('period', opt.key)}
          />
        ))}
      </div>
    </div>
  )
}
