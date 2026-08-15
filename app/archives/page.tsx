import Link from 'next/link'
import { Suspense } from 'react'
import ArchivesFilters from '@/components/ArchivesFilters'
import ArchivesFeed from '@/components/ArchivesFeed'
import { getArchiveFeed, parseArchivePeriod } from '@/lib/archives'

export const metadata = {
  title: 'Archives — The Build Report',
  description: 'Browse past Build Briefs — filter by period.',
}

export const dynamic = 'force-dynamic'

export default async function ArchivesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const period = parseArchivePeriod(searchParams?.period)
  const items = await getArchiveFeed({ period })

  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>
          ← Build Report
        </Link>
      </p>

      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        Archives
      </h1>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Past clawdbotatg Build Briefs. Editions stay available for about 90 days.
      </p>

      <Suspense fallback={null}>
        <ArchivesFilters period={period} />
      </Suspense>

      <ArchivesFeed items={items} />
    </>
  )
}
