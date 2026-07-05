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
        Condensed Chronicle summary maintained in admin. Prepended to live AI autoscore and rescore prompts so scores can
        reference the same grounding as launch-baseline repos.
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
          Not configured yet — live AI scores run without Chronicle grounding paste.
        </p>
      )}
    </section>
  )
}
