import type { Metadata } from 'next'
import './globals.css'
import './mobile.css'
import Web3Provider from '@/components/wallet/Web3Provider'
import { ColorThemeProvider } from '@/components/ColorThemeProvider'
import NavBar from '@/components/NavBar'
import { COLOR_THEME_STORAGE_KEY } from '@/lib/colorThemes'

const SITE_URL = 'https://the-build-report.vercel.app'
const SITE_TITLE = 'The Build Report'
const SITE_DESCRIPTION = 'A plain English look at the repos, scored and sourced.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F4F6F8',
}

const themeBootScript = `(function(){try{var t=localStorage.getItem('${COLOR_THEME_STORAGE_KEY}');if(t)document.documentElement.dataset.colorTheme=t}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ColorThemeProvider>
          <Web3Provider>
            <NavBar />
            <main className="site-main" style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto', padding: '32px var(--content-padding-x) 80px' }}>
              {children}
            </main>
            <footer className="site-footer" style={{
              borderTop: '1px solid var(--border)',
              padding: '20px 24px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}>
              The Build Report is an independent community project. Not affiliated with clawdbotatg, Austin Griffith, or the core team. Not financial advice.
            </footer>
          </Web3Provider>
        </ColorThemeProvider>
      </body>
    </html>
  )
}
