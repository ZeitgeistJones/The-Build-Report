import { SCORING_CONTEXT_VERSION } from '@/lib/ecosystemContext'

export default function ScoringContextSection({
  activeText,
  usingOverride,
}: {
  activeText: string
  usingOverride: boolean
}) {
  return (
    <section id="context" style={{ marginBottom: '28px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Scoring context v{SCORING_CONTEXT_VERSION}
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>
        Live AI scores read this background plus each repo&apos;s GitHub metadata. Launch baseline (Jun 15) grades used a
        separate editorial pass with row-by-row Chronicle citations.
      </p>
      {usingOverride && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            margin: '0 0 12px',
            padding: '10px 12px',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}
        >
          Admin override is active — this is what autoscore uses today.
        </p>
      )}
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          margin: 0,
        }}
      >
        {activeText}
      </pre>
    </section>
  )
}
