const PRE_STYLE = {
  whiteSpace: 'pre-wrap' as const,
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  lineHeight: 1.6,
  color: 'var(--text-secondary)',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '16px',
  margin: 0,
}

export default function ChronicleContextSection({ activeText }: { activeText: string | null }) {
  const configured = Boolean(activeText?.trim())

  return (
    <section id="chronicle-context" style={{ marginBottom: '28px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Chronicle context
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>
        Optional admin addendum for dated Chronicle updates. Timeline anchors and repo history already live in{' '}
        <a href="#context" style={{ color: 'var(--accent)' }}>ecosystem context</a> above; this box is only prepended
        when non-empty (e.g. post-launch facts verified after the ecosystem paste was written).
      </p>
      {configured ? (
        <pre style={PRE_STYLE}>{activeText}</pre>
      ) : (
        <p
          style={{
            ...PRE_STYLE,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
          }}
        >
          No addendum — live AI still uses Chronicle timeline and repo facts from ecosystem context.
        </p>
      )}
    </section>
  )
}
