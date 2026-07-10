import Link from 'next/link'
import { Suspense } from 'react'
import ArchivesFilters from '@/components/ArchivesFilters'
import ArchivesFeed from '@/components/ArchivesFeed'
import {
  getArchiveFeed,
  parseArchivePeriod,
  parseArchiveType,
} from '@/lib/archives'

export const metadata = {
  title: 'Archives — The Build Report',
  description:
    'Browse past Build Briefs, The Needle, Spotted, and Overheard columns — filter by type and period.',
}

export const dynamic = 'force-dynamic'

export default async function ArchivesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const type = parseArchiveType(searchParams?.type)
  const period = parseArchivePeriod(searchParams?.period)
  const items = await getArchiveFeed({ type, period })

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
        Past Briefs, Needles, Spotted, and Overheard. Briefs and Needles keep ~90 days going forward;
        Spotted and Overheard keep published history longer.
      </p>

      <Suspense fallback={null}>
        <ArchivesFilters type={type} period={period} />
      </Suspense>

      <ArchivesFeed items={items} />
    </>
  )
}
