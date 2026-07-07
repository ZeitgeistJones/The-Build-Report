'use client'

import { RUBRIC_REFERENCE_ECOSYSTEM, RUBRIC_REFERENCE_REPO } from '@/lib/rubricReference'
import { BUILDER_STANDARDS_CROSS_CUTTING } from '@/lib/builderStandardsExamples'
import RubricBlockPanel from '@/components/RubricBlockPanel'

export default function HowWeScoreRubrics() {
  return (
    <section id="hw-score-rubrics" style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
        Score rubrics
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
        Per-repo cards show Holder economics (scored through a direct-burn or shipping-leverage lens, depending on repo type) plus builder standards. Expand each row for definitions and observable signal examples.
      </p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
        <strong style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Score floors:</strong>{' '}
        A small set of critical-path repos (see role badges on repo cards) have display grades floored at C- (70) while functioning as designed — the floor and the repo list are fixed in code, not AI-inferred.
      </p>

      <div
        id="bi-cross-cutting"
        className="how-we-score-card"
        style={{
          marginBottom: '16px',
          padding: '12px 14px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Cross-cutting signals
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px' }}>
          {BUILDER_STANDARDS_CROSS_CUTTING.map(line => (
            <li key={line} style={{ marginBottom: '4px' }}>{line}</li>
          ))}
        </ul>
      </div>

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
