'use client'

import { RUBRIC_REFERENCE_ECOSYSTEM, RUBRIC_REFERENCE_REPO } from '@/lib/rubricReference'
import RubricBlockPanel from '@/components/RubricBlockPanel'

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
