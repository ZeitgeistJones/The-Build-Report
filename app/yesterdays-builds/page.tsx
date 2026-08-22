import Link from 'next/link'
import ExternalBriefsNewspaper from '@/components/ExternalBriefsNewspaper'
import YbMissingEdition, { missingEditionCopy } from '@/components/YbMissingEdition'
import { getAllExternalBriefs } from '@/lib/externalOwnerBrief'
import {
  hasCachedYbEdition,
  latestYbIssueDateKey,
  resolveYbIssueDate,
} from '@/lib/ybIssue'

export const metadata = {
  title: 'Outside Desk — The Build Report',
  description:
    'Unofficial overnight shipping notes for tracked GitHub projects outside clawdbotatg — separate from CLAWD’s homepage Yesterday’s Build.',
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

  return (
    <>
      <BackLink />
      <ExternalBriefsNewspaper
        briefs={briefs}
        issueDateKey={dateKey}
        latestDateKey={latestDateKey}
      />
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
