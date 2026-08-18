import Link from 'next/link'
import YbIssueNav from '@/components/YbIssueNav'
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
    <section className="ext-paper yb-missing-edition" aria-label="Yesterday's Builds">
      <header className="ext-paper-masthead">
        <h2 className="ext-paper-masthead__title">Yesterday&apos;s Builds</h2>
        <p className="ext-paper-masthead__deck">Free · Independent community project</p>
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
    body: `No archived Yesterday’s Builds edition was found for ${formatIssueLong(dateKey)}.`,
  }
}
