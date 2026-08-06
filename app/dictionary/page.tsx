import Link from 'next/link'
import DictionaryContent from '@/components/DictionaryContent'

export const metadata = {
  title: 'Dictionary — The Build Report',
  description:
    'Layman definitions for crypto, GitHub, coding, AI, and ops terms that show up in score explanations.',
}

export default function DictionaryPage() {
  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>
          ← Build Report
        </Link>
      </p>

      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        Dictionary
      </h1>

      <DictionaryContent />
    </>
  )
}
