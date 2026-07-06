'use client'

import { useState } from 'react'
import RepoList, { type RepoWithLive } from '@/components/RepoList'
import CommunityPulseBanner from '@/components/CommunityPulseBanner'
import type { CommunityPulse } from '@/lib/communityContextTypes'
import type { RepoContextSummary } from '@/lib/communityContextTypes'
import type { RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import type { RepoCollectionId } from '@/lib/repoCollections'

type RepoFilter = 'all' | 'burn-apps' | 'leverage' | 'cv-related' | 'clawd-gated' | 'community-context' | string

interface Props {
  repos: RepoWithLive[]
  githubSlugOrder?: string[]
  initialRescoreSummaries?: Record<string, RescoreSummaryRecord>
  repoCollections?: Record<RepoCollectionId, string[]>
  communityContextEnabled?: boolean
  contextSummary?: Record<string, RepoContextSummary>
  communityPulse: CommunityPulse | null
}

export default function HomeRepoSection({
  repos,
  githubSlugOrder,
  initialRescoreSummaries,
  repoCollections,
  communityContextEnabled = false,
  contextSummary = {},
  communityPulse,
}: Props) {
  const [filterControl, setFilterControl] = useState<{
    filter: RepoFilter
    expandSlugs: string[]
  } | null>(null)

  function handleReviewCommunity() {
    const expandSlug = communityPulse?.highlights[0]?.slug
    setFilterControl({
      filter: 'community-context',
      expandSlugs: expandSlug ? [expandSlug] : [],
    })
    requestAnimationFrame(() => {
      document.getElementById('repo-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <>
      {communityContextEnabled && communityPulse && communityPulse.repoCount > 0 && (
        <CommunityPulseBanner pulse={communityPulse} onReview={handleReviewCommunity} />
      )}
      <div id="repo-list">
        <RepoList
          repos={repos}
          githubSlugOrder={githubSlugOrder}
          initialRescoreSummaries={initialRescoreSummaries}
          repoCollections={repoCollections}
          communityContextEnabled={communityContextEnabled}
          contextSummary={contextSummary}
          filterControl={filterControl}
        />
      </div>
    </>
  )
}
