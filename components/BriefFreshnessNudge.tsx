'use client'

export default function BriefFreshnessNudge() {
  function zapToRepos() {
    document.getElementById('repo-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className="brief-freshness-nudge" aria-label="How activity and rescoring feed the daily columns">
      <p className="brief-freshness-nudge__lead">
        Want a sharper <strong>Yesterday&apos;s Build</strong> and <strong>The Needle</strong>?
      </p>
      <p className="brief-freshness-nudge__body">
        <strong>Yesterday&apos;s Build</strong> summarizes what landed on GitHub yesterday — commits
        and a fresh scan drive that story. Rescoring keeps repo scores current for the grade context
        around it, but it isn&apos;t the main input.
      </p>
      <p className="brief-freshness-nudge__body">
        <strong>The Needle</strong> is different: it reports on rescoring — grade moves and what
        changed underneath. More rescoring means more material for that column.
      </p>
      <p className="brief-freshness-nudge__body">
        Score or Rescore is one click on a repo card — and during this launch promo you aren&apos;t
        paying: the site operator subsidizes it. Eligible runs send ETH to your wallet{' '}
        <em>and</em> an equal amount into the buy-and-burn queue for CLAWD.
      </p>
      <button type="button" className="brief-freshness-nudge__zap" onClick={zapToRepos}>
        Repos that need a rescore →
      </button>
    </aside>
  )
}
