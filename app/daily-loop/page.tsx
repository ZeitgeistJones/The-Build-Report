import Link from 'next/link'
import ExternalBriefsNewspaper from '@/components/ExternalBriefsNewspaper'
import YbMissingEdition, { missingEditionCopy } from '@/components/YbMissingEdition'
import {
  getAllExternalBriefs,
  healDailyLoopEdition,
  listDailyLoopDeskGaps,
} from '@/lib/externalOwnerBrief'
import { getMcpWireAdmin } from '@/lib/mcpWire'
import {
  hasCachedYbEdition,
  latestYbIssueDateKey,
  resolveYbIssueDate,
} from '@/lib/ybIssue'

export const dynamic = 'force-dynamic'
/** Page may briefly heal a few missing desks before render. */
export const maxDuration = 60

export default async function DailyLoopPage({
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

  // Self-heal: fill as many missing/stuck desks as the request budget allows.
  // Hobby only allows one heal cron/day, so page load is the real safety net.
  try {
    const gaps = await listDailyLoopDeskGaps(dateKey)
    if (gaps.missing.length > 0 || gaps.stuck.length > 0) {
      await healDailyLoopEdition({
        dateKey,
        maxAttempts: 12,
        deadlineMs: Date.now() + 45_000,
      })
    }
  } catch (err) {
    console.error('[daily-loop] page heal failed', err)
  }

  const [briefs, wireAdmin] = await Promise.all([
    getAllExternalBriefs(dateKey),
    getMcpWireAdmin(dateKey),
  ])

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
        mcpWire={wireAdmin?.snapshot ?? null}
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
