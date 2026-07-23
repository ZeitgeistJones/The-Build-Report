'use client'

import type { OpenPromoRewardsSummary } from '@/lib/rescorePromo'

type Props = {
  openRewards?: OpenPromoRewardsSummary | null
}

export default function BriefFreshnessNudge({ openRewards = null }: Props) {
  function zapToRepos() {
    document.getElementById('repo-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const showAmount = Boolean(openRewards?.active && openRewards.repoCount > 0)
  const promoActive = Boolean(openRewards?.active)

  return (
    <aside className="brief-freshness-nudge" aria-label="Rescoring, The Needle, and open promo rewards">
      <div className="brief-freshness-nudge__card">
        <div className="brief-freshness-nudge__row">
          <div className="brief-freshness-nudge__copy">
            {promoActive ? (
              <p className="brief-freshness-nudge__eyebrow">Open promo rewards</p>
            ) : (
              <p className="brief-freshness-nudge__eyebrow">Daily columns</p>
            )}
            <p className="brief-freshness-nudge__lead">
              {promoActive
                ? 'Feed The Needle — Score / Rescore is free right now'
                : 'Rescoring feeds The Needle'}
            </p>
            <p className="brief-freshness-nudge__body">
              Commits write Yesterday&apos;s Build. Rescores write The Needle.
              {promoActive
                ? ' Eligible runs pay your wallet and the CLAWD burn queue.'
                : ' Score or Rescore on a repo card when you want the column to move.'}
            </p>
            <button type="button" className="brief-freshness-nudge__zap" onClick={zapToRepos}>
              Repos that need a rescore →
            </button>
          </div>

          {showAmount && openRewards && (
            <div className="brief-freshness-nudge__amount" aria-label="Unclaimed promo wallet rewards">
              <p className="brief-freshness-nudge__usd">{openRewards.usdLabel}</p>
              <p className="brief-freshness-nudge__amount-meta">
                waiting to be earned via rescore
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
