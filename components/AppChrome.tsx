'use client'

import { usePathname } from 'next/navigation'
import NavBar from '@/components/NavBar'
import RescorePromoBannerShell from '@/components/RescorePromoBannerShell'

// Routes that should render edge-to-edge with no nav, banner, or footer.
// Matches the route itself and any sub-paths (e.g. "/sky/foo").
const FULLSCREEN_ROUTES = ['/sky']

/** Keep nav/footer, but drop the centered content max-width. */
const FULL_BLEED_CONTENT_ROUTES: string[] = []

function isFullscreenRoute(pathname: string | null) {
  if (!pathname) return false
  return FULLSCREEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

function isFullBleedContentRoute(pathname: string | null) {
  if (!pathname) return false
  return FULL_BLEED_CONTENT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (isFullscreenRoute(pathname)) {
    // Full-bleed: no nav, no promo banner, no padded main, no footer.
    // EcosystemSky.jsx already renders its own "← The Build Report" back link.
    return <>{children}</>
  }

  const fullBleedContent = isFullBleedContentRoute(pathname)

  return (
    <>
      <NavBar />
      <RescorePromoBannerShell />
      <main
        className={fullBleedContent ? 'site-main site-main--fullbleed' : 'site-main'}
        style={
          fullBleedContent
            ? {
                width: '100%',
                maxWidth: 'none',
                margin: 0,
                boxSizing: 'border-box',
                padding: '32px var(--content-padding-x) 80px',
              }
            : {
                maxWidth: 'var(--content-max-width)',
                margin: '0 auto',
                padding: '32px var(--content-padding-x) 80px',
              }
        }
      >
        {children}
      </main>
      <footer
        className="site-footer"
        style={{
          borderTop: '1px solid var(--border)',
          padding: '20px 24px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        The Build Report is an independent community project. Not affiliated with clawdbotatg, Austin Griffith, or the core team. Not financial advice.
      </footer>
    </>
  )
}
