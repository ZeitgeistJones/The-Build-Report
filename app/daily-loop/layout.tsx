import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://the-build-report.vercel.app'
const TITLE = 'The Daily Loop'
const DESCRIPTION =
  'Stay in it — unofficial overnight shipping notes for tracked AI agent projects outside clawdbotatg.'

export const metadata: Metadata = {
  title: `${TITLE} — The Build Report`,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: `${SITE_URL}/daily-loop`,
    siteName: 'The Build Report',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function DailyLoopLayout({ children }: { children: React.ReactNode }) {
  return children
}
