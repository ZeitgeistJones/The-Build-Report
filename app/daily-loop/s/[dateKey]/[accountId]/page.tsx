import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  loadYbStorySharePayload,
  ybStoryXIntentUrl,
} from '@/lib/ybStoryShare'
import { canonicalYbIssuePath } from '@/lib/ybIssue'

export const dynamic = 'force-dynamic'

type Params = { dateKey: string; accountId: string }

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const payload = await loadYbStorySharePayload(params.dateKey, params.accountId)
  if (!payload) {
    return { title: 'Story not found — The Daily Loop' }
  }
  return {
    title: `${payload.headline} — The Daily Loop`,
    description: payload.teaser,
    openGraph: {
      title: payload.headline,
      description: payload.teaser,
      type: 'article',
      url: payload.shareUrl,
      siteName: 'The Build Report',
    },
    twitter: {
      card: 'summary_large_image',
      title: payload.headline,
      description: payload.teaser,
    },
  }
}

export default async function DailyLoopStorySharePage({
  params,
}: {
  params: Params
}) {
  const payload = await loadYbStorySharePayload(params.dateKey, params.accountId)
  if (!payload) notFound()

  const xUrl = ybStoryXIntentUrl(payload)
  const issuePath = `${canonicalYbIssuePath(payload.dateKey)}#${payload.accountId}`

  return (
    <main className="yb-share">
      <p className="yb-share__back">
        <Link href={issuePath}>← Full issue</Link>
        <span className="yb-share__sep">·</span>
        <Link href="/">Build Report</Link>
      </p>

      <article className="yb-share__card">
        <p className="yb-share__kicker">
          {payload.label}
          <span className="yb-share__sep"> · </span>
          The Daily Loop
        </p>
        <h1 className="yb-share__headline">{payload.headline}</h1>
        <p className="yb-share__issue">{payload.issueLabel}</p>
        <p className="yb-share__teaser">{payload.teaser}</p>

        <div className="yb-share__actions">
          <Link href={issuePath} className="yb-share__primary">
            Read the full story →
          </Link>
          <a
            href={xUrl}
            className="yb-share__secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on X
          </a>
        </div>

        <p className="yb-share__fine">
          Unofficial overnight skim · Independent community project · Not affiliated with{' '}
          {payload.label}
        </p>
      </article>
    </main>
  )
}
