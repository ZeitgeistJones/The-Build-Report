import Link from 'next/link'
import YbIssueNav from '@/components/YbIssueNav'
import { OUTSIDE_DESK_DECK, OUTSIDE_DESK_TITLE } from '@/lib/externalOwnerBrief'
import { formatIssueLong } from '@/lib/ybIssue'

export default function YbMissingEdition({
  dateKey,
  latestDateKey,
  title,
  body,
}: {
  dateKey: string
  latestDateKey: string
  title: string
  body: string
}) {
  return (
    <section className="ext-paper yb-missing-edition" aria-label={OUTSIDE_DESK_TITLE}>
      <header className="ext-paper-masthead">
        <h2 className="ext-paper-masthead__title">{OUTSIDE_DESK_TITLE}</h2>
        <p className="ext-paper-masthead__deck">{OUTSIDE_DESK_DECK}</p>
      </header>
      <div className="ext-paper-rule ext-paper-rule--double" />
      <YbIssueNav dateKey={dateKey} latestDateKey={latestDateKey} showLatestLink />
      <p className="yb-missing-edition__kicker">{title}</p>
      <p className="yb-missing-edition__body">{body}</p>
      <p className="yb-missing-edition__back">
        <Link href="/yesterdays-builds">← Latest issue</Link>
      </p>
    </section>
  )
}

export function missingEditionCopy(dateKey: string): { title: string; body: string } {
  return {
    title: 'NO EDITION ON FILE',
    body: `No archived Outside Desk edition was found for ${formatIssueLong(dateKey)}.`,
  }
}
