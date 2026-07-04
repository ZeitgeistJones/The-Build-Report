import Link from 'next/link'
import {
  DEFAULT_ECOSYSTEM_CONTEXT,
  getEcosystemContext,
  SCORING_CONTEXT_VERSION,
} from '@/lib/ecosystemContext'

export const metadata = {
  title: 'Scoring context — The Build Report',
  description: 'Background text the AI reads when scoring clawdbotatg repos.',
}

export default async function ContextPage() {
  const override = await getEcosystemContext().catch(() => null)
  const activeText = override?.trim() || DEFAULT_ECOSYSTEM_CONTEXT
  const usingOverride = Boolean(override?.trim())

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px 64px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>
          ← Build Report
        </Link>
      </p>

      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        Scoring context v{SCORING_CONTEXT_VERSION}
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 24px' }}>
        Live AI scores read this background plus each repo&apos;s GitHub metadata. Repo cards link here from the{' '}
        <code style={{ fontSize: '12px' }}>context v{SCORING_CONTEXT_VERSION}</code> badge on Live AI grades.
        Launch baseline (Jun 15) grades used a separate editorial pass with row-by-row Chronicle citations.
      </p>

      {usingOverride && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            margin: '0 0 16px',
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

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px', lineHeight: 1.5 }}>
        For the living project narrative, see the{' '}
        <Link href="/#chronicle" style={{ color: 'var(--accent)' }}>
          Chronicle
        </Link>{' '}
        section on the homepage or{' '}
        <a href="https://github.com/clawdbotatg/clawd-chronicle" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
          clawd-chronicle on GitHub
        </a>
        .
      </p>
    </main>
  )
}
