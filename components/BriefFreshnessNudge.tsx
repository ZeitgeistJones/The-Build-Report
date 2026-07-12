'use client'

export default function BriefFreshnessNudge() {
  function zapToRepos() {
    document.getElementById('repo-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className="brief-freshness-nudge" aria-label="How rescoring keeps the brief current">
      <p className="brief-freshness-nudge__lead">
        Want a sharper <strong>Yesterday&apos;s build</strong> and <strong>The Needle</strong>?
      </p>
      <p className="brief-freshness-nudge__body">
        Those columns pull from recently scored repos. The more people rescore, the more current
        material overnight digests can use. Score or Rescore is one click on a repo card — and during
        the launch promo, eligible runs can pay ETH to your wallet.
      </p>
      <button type="button" className="brief-freshness-nudge__zap" onClick={zapToRepos}>
        Repos that need a rescore →
      </button>
    </aside>
  )
}
