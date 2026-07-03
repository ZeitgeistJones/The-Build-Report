'use client'

import { useEffect, useState } from 'react'
import ConnectWalletButton from './wallet/ConnectWalletButton'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

function DesktopNavLinks() {
  return (
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
  )
}

function MobileNavMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return

    const scrollY = window.scrollY
    document.body.classList.add('scroll-lock')
    document.body.style.top = `-${scrollY}px`

    return () => {
      document.body.classList.remove('scroll-lock')
      document.body.style.top = ''
      window.scrollTo(0, scrollY)
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div
        role="presentation"
        className="mobile-nav-backdrop"
        onClick={onClose}
      />
      <div id="mobile-nav-menu" className="mobile-nav-panel">
        <a href="/" className="mobile-nav-link" onClick={onClose}>
          Repos
        </a>
        <a href="/about" className="mobile-nav-link" onClick={onClose}>
          About
        </a>
        <a href="/#how-we-score" className="mobile-nav-link" onClick={onClose}>
          How we score
        </a>
        <a
          href="https://github.com/clawdbotatg"
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-nav-link"
          onClick={onClose}
        >
          ↗ clawdbotatg on GitHub
        </a>
      </div>
    </>
  )
}

export default function NavBar() {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!isMobile) setMenuOpen(false)
  }, [isMobile])

  return (
    <nav
      className={isMobile ? 'site-nav' : undefined}
      style={{
        borderBottom: '1px solid var(--border)',
        padding: isMobile ? '0 16px' : '0 24px',
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

      {isMobile ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ConnectWalletButton />
            <button
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-menu"
              onClick={() => setMenuOpen(o => !o)}
              style={{
                width: MIN_TAP,
                height: MIN_TAP,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                fontSize: '18px',
                flexShrink: 0,
                WebkitAppearance: 'none',
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
          <MobileNavMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
        </>
      ) : (
        <DesktopNavLinks />
      )}
    </nav>
  )
}
