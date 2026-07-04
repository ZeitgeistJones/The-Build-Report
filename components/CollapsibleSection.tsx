import type { ReactNode } from 'react'

interface Props {
  id?: string
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}

export default function CollapsibleSection({
  id,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: Props) {
  return (
    <details
      id={id}
      open={defaultOpen}
      style={{
        marginBottom: '16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          padding: '14px 16px',
          cursor: 'pointer',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
          userSelect: 'none',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.45 }}>
              {subtitle}
            </div>
          )}
        </div>
        <span
          aria-hidden
          style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}
        >
          ▼
        </span>
      </summary>
      <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
        {children}
      </div>
    </details>
  )
}
