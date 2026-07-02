'use client'

import ConnectWalletButton from './wallet/ConnectWalletButton'

export default function NavBar() {
  return (
    <nav
      style={{
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
      }}
    >
      <a
        href="/"
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          fontSize: '13px',
          color: 'var(--accent)',
          letterSpacing: '0.02em',
        }}
      >
        The Build Report
      </a>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <a href="/" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Repos
        </a>
        <a href="/about" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          About
        </a>
        <a href="/#how-we-score" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          How we score
        </a>
        <a
          href="https://github.com/clawdbotatg"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '13px', color: 'var(--text-muted)' }}
        >
          ↗ clawdbotatg
        </a>
        <ConnectWalletButton />
      </div>
    </nav>
  )
}
