import Link from 'next/link'
import ExternalBriefsNewspaper from '@/components/ExternalBriefsNewspaper'
import McpWire from '@/components/McpWire'
import YbMissingEdition, { missingEditionCopy } from '@/components/YbMissingEdition'
import { getAllExternalBriefs } from '@/lib/externalOwnerBrief'
import { getMcpWire } from '@/lib/mcpWire'
import {
  hasCachedYbEdition,
  latestYbIssueDateKey,
  resolveYbIssueDate,
} from '@/lib/ybIssue'

export const metadata = {
  title: "Yesterday's Builds — The Build Report",
  description:
    'Overnight shipping digests for builders and projects tracked outside the main clawdbotatg report.',
}

export const dynamic = 'force-dynamic'

export default async function YesterdaysBuildsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const latestDateKey = latestYbIssueDateKey()
  const resolved = resolveYbIssueDate(searchParams?.date, latestDateKey)

  if (!resolved.ok) {
    const title = 'NO EDITION ON FILE'
    const body =
      resolved.reason === 'future'
        ? 'That issue hasn’t published yet.'
        : 'That isn’t a valid issue date.'
    return (
      <>
        <BackLink />
        <YbMissingEdition
          dateKey={latestDateKey}
          latestDateKey={latestDateKey}
          title={title}
          body={body}
        />
      </>
    )
  }

  const dateKey = resolved.dateKey
  const briefs = await getAllExternalBriefs(dateKey)

  if (resolved.requested && !hasCachedYbEdition(briefs)) {
    const copy = missingEditionCopy(dateKey)
    return (
      <>
        <BackLink />
        <YbMissingEdition
          dateKey={dateKey}
          latestDateKey={latestDateKey}
          title={copy.title}
          body={copy.body}
        />
      </>
    )
  }

  const wire = await getMcpWire(dateKey).catch(() => null)

  return (
    <>
      <BackLink />
      <ExternalBriefsNewspaper
        briefs={briefs}
        issueDateKey={dateKey}
        latestDateKey={latestDateKey}
      />
      <McpWire wire={wire} />
    </>
  )
}

function BackLink() {
  return (
    <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
      <Link href="/" style={{ color: 'var(--text-muted)' }}>
        ← Build Report
      </Link>
    </p>
  )
}
