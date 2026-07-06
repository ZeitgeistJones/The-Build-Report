'use client'

import InfoTooltip from '@/components/InfoTooltip'
import type { RubricReferenceBlock } from '@/lib/rubricReference'
import { BUILDER_STANDARDS_BY_ANCHOR } from '@/lib/builderStandardsExamples'
import { BI_WEIGHTS_TOOLTIP } from '@/lib/rubrics/builderIntegrity'

const ROW_SUMMARY_STYLE = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '12px',
  cursor: 'pointer',
  listStyle: 'none',
  padding: '8px 0',
  borderBottom: '1px solid var(--border)',
} as const

function StandardsExamples({ anchorId }: { anchorId: string }) {
  const ex = BUILDER_STANDARDS_BY_ANCHOR[anchorId]
  if (!ex) return null
  const tier = (label: string, items: string[]) =>
    items.length ? (
      <div style={{ marginTop: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px' }}>
          {label}
        </div>
        <ul style={{ margin: 0, paddingLeft: '16px' }}>
          {items.map(item => (
            <li key={item} style={{ marginBottom: '3px' }}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
        Observable signals (generic)
      </div>
      {tier('High', ex.high)}
      {tier('Mid', ex.mid)}
      {tier('Low', ex.low)}
    </div>
  )
}

function RubricRowDetail({ row }: { row: RubricReferenceBlock['rows'][number] }) {
  return (
    <details className="hw-rubric-row" id={row.anchorId}>
      <summary style={ROW_SUMMARY_STYLE}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0 }}>
          {row.label}
        </span>
        <span
          style={{
            fontWeight: 500,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            flexShrink: 0,
          }}
        >
          {row.weight}
        </span>
      </summary>
      <div style={{ padding: '0 0 10px 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)' }}>{row.teaser}</p>
        <p style={{ margin: 0 }}>{row.detail}</p>
        <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          low 33 · mid 67 · high 100 pts (per row max)
        </p>
        {row.anchorId && <StandardsExamples anchorId={row.anchorId} />}
      </div>
    </details>
  )
}

export default function RubricBlockPanel({
  block,
  defaultOpen,
  compact,
}: {
  block: RubricReferenceBlock
  defaultOpen?: boolean
  compact?: boolean
}) {
  const isBi = block.id === 'builder-integrity'
  const open = defaultOpen ?? (block.id === 'token-mechanic' || block.id === 'builder-integrity')

  return (
    <details
      id={`hw-rubric-${block.id}`}
      className="hw-rubric-block"
      open={open}
      style={{
        marginTop: compact ? 0 : '12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          padding: '12px 14px',
          cursor: 'pointer',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {block.title}
            </span>
            {isBi && (
              <InfoTooltip
                content={BI_WEIGHTS_TOOLTIP}
                ariaLabel="Why builder standards weights are 22% and 18%"
                icon="question"
                width={280}
                compact
              />
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.45 }}>
            {block.appliesTo}
          </div>
        </div>
        <span aria-hidden style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
          ▼
        </span>
      </summary>
      <div style={{ padding: '0 14px 12px', borderTop: '1px solid var(--border)' }}>
        {block.rows.map(row => (
          <RubricRowDetail key={row.label} row={row} />
        ))}
        <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          {block.note}
        </p>
      </div>
    </details>
  )
}
