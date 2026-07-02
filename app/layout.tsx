import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Build Report',
  description: 'A plain English look at the repos, scored and sourced.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '52px',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
        }}>
          <a href="/" style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            fontSize: '13px',
            color: 'var(--accent)',
            letterSpacing: '0.02em',
          }}>
            The Build Report
          </a>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <a href="/" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Repos</a>
            <a href="/about" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>About</a>
            <a
              href="https://github.com/clawdbotatg"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '13px', color: 'var(--text-muted)' }}
            >
              ↗ clawdbotatg
            </a>
          </div>
        </nav>
        <main style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto', padding: '32px var(--content-padding-x) 80px' }}>
          {children}
        </main>
        <footer style={{
          borderTop: '1px solid var(--border)',
          padding: '20px 24px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}>
          The Build Report is an independent community project. Not affiliated with clawdbotatg, Austin Griffith, or the core team. Not financial advice.
        </footer>
      </body>
    </html>
  )
}
