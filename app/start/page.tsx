import Link from 'next/link'
import StartHereContent from '@/components/StartHereContent'

export const metadata = {
  title: 'Start Here — The Build Report',
  description: 'Plain-English guide to reading The Build Report: scores, activity, filters, and token basics.',
}

export default function StartHerePage() {
  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>
          ← Build Report
        </Link>
      </p>

      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        Start Here
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        How to use this site — no GitHub or crypto expertise required.
      </p>

      <StartHereContent />
    </>
  )
}
