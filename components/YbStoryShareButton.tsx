'use client'

import { useMemo } from 'react'
import {
  dailyLoopIssueStoryUrl,
  dailyLoopStoryShareUrl,
  ybStoryXIntentUrl,
  type YbStorySharePayload,
} from '@/lib/ybStoryShare'

type Props = {
  dateKey: string
  accountId: YbStorySharePayload['accountId']
  label: string
  headline: string
  teaser: string
  issueLabel: string
}

export default function YbStoryShareButton({
  dateKey,
  accountId,
  label,
  headline,
  teaser,
  issueLabel,
}: Props) {
  const href = useMemo(() => {
    const payload: YbStorySharePayload = {
      dateKey,
      accountId,
      label,
      headline,
      teaser,
      shareUrl: dailyLoopStoryShareUrl(dateKey, accountId),
      issueUrl: dailyLoopIssueStoryUrl(dateKey, accountId),
      issueLabel,
      commitCount: 0,
      repoCount: 0,
    }
    return ybStoryXIntentUrl(payload)
  }, [dateKey, accountId, label, headline, teaser, issueLabel])

  return (
    <a
      className="ext-paper-share"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Share ${headline} on X`}
    >
      Share on X
    </a>
  )
}
