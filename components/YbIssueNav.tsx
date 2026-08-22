'use client'

import Link from 'next/link'
import CopyIssueLink from '@/components/CopyIssueLink'
import {
  canonicalYbIssuePath,
  formatIssueShort,
  ybIssueNavDates,
} from '@/lib/ybIssue'

export default function YbIssueNav({
  dateKey,
  latestDateKey,
  showLatestLink = false,
}: {
  dateKey: string
  latestDateKey: string
  showLatestLink?: boolean
}) {
  const { prevDateKey, nextDateKey } = ybIssueNavDates(dateKey, latestDateKey)
  const isLatest = dateKey === latestDateKey

  return (
    <nav className="yb-issue-nav" aria-label="Issue navigation">
      <Link href={canonicalYbIssuePath(prevDateKey)} className="yb-issue-nav__link">
        ← {formatIssueShort(prevDateKey)}
      </Link>
      <div className="yb-issue-nav__mid">
        <CopyIssueLink path={canonicalYbIssuePath(dateKey)} />
        {(showLatestLink || !isLatest) && (
          <Link href="/daily-loop" className="yb-issue-nav__latest">
            Latest issue
          </Link>
        )}
      </div>
      {nextDateKey ? (
        <Link href={canonicalYbIssuePath(nextDateKey)} className="yb-issue-nav__link yb-issue-nav__link--next">
          {formatIssueShort(nextDateKey)} →
        </Link>
      ) : (
        <span className="yb-issue-nav__link yb-issue-nav__link--disabled">Next issue</span>
      )}
    </nav>
  )
}
