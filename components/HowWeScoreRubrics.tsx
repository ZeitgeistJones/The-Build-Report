'use client'

import InfoTooltip from '@/components/InfoTooltip'
import {
  RUBRIC_REFERENCE_ECOSYSTEM,
  RUBRIC_REFERENCE_REPO,
  type RubricReferenceBlock,
} from '@/lib/rubricReference'
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

function RubricRowDetail({ row }: { row: RubricReferenceBlock['rows'][number] }) {
  return (
    <details className="hw-rubric-row">
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
      </div>
    </details>
  )
}

function RubricBlockPanel({ block }: { block: RubricReferenceBlock }) {
  const isBi = block.id === 'builder-integrity'
  const defaultOpen = block.id === 'token-mechanic' || block.id === 'builder-integrity'

  return (
    <details
      id={`hw-rubric-${block.id}`}
      className="hw-rubric-block"
      open={defaultOpen}
      style={{
        marginTop: '12px',
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
                ariaLabel="Why builder integrity weights are 22% and 18%"
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

export default function HowWeScoreRubrics() {
  return (
    <section id="hw-score-rubrics" style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
        Score rubrics
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
        Per-repo cards use token mechanic or shipping leverage plus builder integrity. Expand each row for definitions.
      </p>

      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
        Per-repo (3 grades on each card)
      </div>
      {RUBRIC_REFERENCE_REPO.map(block => (
        <RubricBlockPanel key={block.id} block={block} />
      ))}

      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginTop: '20px',
          marginBottom: '4px',
        }}
      >
        Ecosystem-only (Grades panel)
      </div>
      {RUBRIC_REFERENCE_ECOSYSTEM.map(block => (
        <RubricBlockPanel key={block.id} block={block} />
      ))}
    </section>
  )
}
