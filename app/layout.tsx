import type { Metadata } from 'next'
import './globals.css'
import Web3Provider from '@/components/wallet/Web3Provider'
import NavBar from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'The Build Report',
  description: 'A plain English look at the repos, scored and sourced.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <NavBar />
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
        </Web3Provider>
      </body>
    </html>
  )
}
