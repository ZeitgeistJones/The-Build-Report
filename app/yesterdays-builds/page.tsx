import Link from 'next/link'
import ExternalBriefsNewspaper from '@/components/ExternalBriefsNewspaper'
import McpWire from '@/components/McpWire'
import { yesterdayMountainDateKey } from '@/lib/buildBrief'
import { getAllExternalBriefs } from '@/lib/externalOwnerBrief'
import { getMcpWire } from '@/lib/mcpWire'

export const metadata = {
  title: "Yesterday's Builds — The Build Report",
  description:
    'Overnight shipping digests for builders and projects tracked outside the main clawdbotatg report.',
}

export const dynamic = 'force-dynamic'

export default async function YesterdaysBuildsPage() {
  const dateKey = yesterdayMountainDateKey()
  const briefs = await getAllExternalBriefs()
  const wire = await getMcpWire(dateKey).catch(() => null)

  return (
    <>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>
          ← Build Report
        </Link>
      </p>

      <ExternalBriefsNewspaper briefs={briefs} />
      <McpWire wire={wire} />
    </>
  )
}
