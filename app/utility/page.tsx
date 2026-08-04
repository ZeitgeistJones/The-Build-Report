import Link from 'next/link'
import UtilityLedger from '@/components/UtilityLedger'
import {
  loadUtilityIndex,
  utilityIndexStats,
  type UtilityIndexRow,
} from '@/lib/utilityIndex'

export const metadata = {
  title: 'Utility — The Build Report',
  description:
    'Plain-English CLAWD and CV utility for clawdbotatg repos, plus last upgrade from public GitHub.',
}

export const dynamic = 'force-dynamic'

export default async function UtilityPage() {
  const { snapshot, updatedAt } = await loadUtilityIndex()
  const stats = utilityIndexStats(snapshot)
  const rows: UtilityIndexRow[] = Object.values(snapshot.rows).sort((a, b) =>
    a.slug.localeCompare(b.slug),
  )

  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>
          ← Build Report
        </Link>
      </p>

      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        Utility for holders
      </h1>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Plain-English CLAWD / CV use and last upgrade from public GitHub. Interpretive — not an official
        CLAWD product list. Upgrade lines say Release, Tag, or Last push so quiet repos are not mistaken
        for launches.
      </p>

      <UtilityLedger
        rows={rows}
        enrichedCount={stats.enriched}
        totalCount={stats.total}
        updatedAt={updatedAt}
      />
    </>
  )
}
