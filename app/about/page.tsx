export default function AboutPage() {
  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '8px' }}>
          About The Build Report
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          A plain English look at the repos, scored and sourced.
        </p>
      </div>

      {[
        {
          heading: 'What this is',
          body: `The Build Report is an independent community project tracking what clawdbotatg is building on GitHub and scoring each repo against two criteria: how relevant it is to $CLAWD holders, and how well it reflects clawdbotatg's own stated builder values.

It is not affiliated with clawdbotatg, Austin Griffith, or any core team. It was built by a community member who holds $CLAWD and wanted a clearer picture of what was being built and why.`,
        },
        {
          heading: 'What this is not',
          body: `This is not financial advice. Nothing on this site should be used as the basis for any investment decision.

This is not an official source. Scores are interpretive. They reflect one reading of publicly available information — clawdbotatg's tweets, the Chronicle, and GitHub activity — and reasonable people could score the same repos differently.

This is not a real-time data feed. Scores are updated manually. GitHub activity data refreshes automatically but the scoring rubric and verdicts are human judgements, not automated outputs.`,
        },
        {
          heading: 'How scores are assigned',
          body: `Every repo receives up to two scores: token mechanic and builder integrity. Each score is built from three weighted rubric components, each contributing to a numeric score from 0–100. That percentage maps to a letter grade from A+ down through F (F is below 60%), with a cited source for each component.

Infrastructure and theoretical repos use adapted token mechanic criteria — enables consumer apps that burn CLAWD, downstream path to holder value, active and maintained — rather than the direct burn mechanic criteria used for consumer apps. Every repo gets scored because every repo has some relationship to holder value, direct or indirect.

Scores are assigned against the goals clawdbotatg stated at the time a repo was built, not against where the project ended up. Goals change and a repo should not be penalised retroactively for a direction shift that came later.`,
        },
        {
          heading: 'Score & Rescore',
          body: `Every repo card has a Score or Rescore button. It runs Claude AI inference for that single repo — useful for repos that have not been scored yet, or to refresh an auto-inferred score with a new pass.

Cost: 0.000008 ETH per score. That is a fixed onchain amount; at the time this was built (July 2026) it was approximately $0.02, but ETH price fluctuates so the USD equivalent may be closer to $0.01 or $0.04 depending on when you use it.

When you pay, the ETH is sent to the receiver-buy-and-burn contract (0x0C1a3DB07304D2E4E551AB4A7b083382a33f25ad), which automatically buys and burns $CLAWD via Uniswap V3 — supporting the ecosystem rather than going to a private wallet.

Who can use it: any wallet that passes CLAWDGate tier 1 on Base (10M+ $CLAWD). The full report blur gate uses the same check.

Result is shared: once a repo is scored, the result is cached in Redis and everyone sees it for free — including visitors who have not connected a wallet.`,
        },
        {
          heading: 'Important distinctions',
          body: `CV burns are not CLAWD burns. Burning ClawdViction points removes governance tokens, not $CLAWD itself.

Supply lock is not a burn. Locking CLAWD in a staking or vesting contract removes it from circulation temporarily — it can return. A burn permanently destroys tokens. Both are meaningful but they are not the same thing.

Infrastructure repos are not expected to have direct burn or revenue mechanics. They may still receive adapted token mechanic scores when hand-scored; auto-inferred infrastructure shows N/A. All repos are scored on builder integrity.`,
        },
        {
          heading: 'Sources',
          body: `All scores are sourced from publicly available information: the clawdbotatg Chronicle (Jan 25 – Apr 10, 2026), clawdbotatg's public Twitter/X history, and the public GitHub account at github.com/clawdbotatg.

The Chronicle is the primary grounding document. Where a score references a tweet, the tweet text and approximate date are cited. Nothing is claimed without a source.`,
        },
        {
          heading: 'Corrections and disagreements',
          body: `If you think a score is wrong, that conversation should happen in the open. The scoring methodology is fully documented on the main page. Admin notes can be added to any card for context — scores themselves are not changed quietly.

One known v1 limitation: the 'Agent-authored build' criterion under Builder Integrity infers autonomous coding patterns from repo metadata alone. The human collaborator's role is infrastructure and multisig signing, not code authorship — low scores here reflect inference uncertainty from limited metadata, not evidence of human coding involvement.

This is a speculative, experimental community project. It will have errors. The goal is to be honest about the limits of what it knows.`,
        },
        {
          heading: 'What could come next',
          body: `This is a v1. The scoring categories, rubric weights, and criterion labels were developed quickly using AI-assisted research — not through formal academic validation or extended community scrutiny. They represent a reasonable first attempt, not a final methodology.

With community interest and input, future versions could explore: community-driven formula recalculation — holders burning $CLAWD to propose and vote on rubric changes; commit meaning analysis — Claude-powered breakdowns of what recent commits actually built, funded by small burns so the community shares the cost; holder score verification — burning to formally dispute a score, triggering review and public logging; more scrutinized criteria developed with proper attention to validity, reliability, and labeling; signal bars derived from actual rubric scores rather than tag aggregates; and the ability for project teams to submit context that feeds into how their repos are scored.

There are also directions not yet fully formed — ways the community could participate in scoring that go beyond just reading results, governance mechanisms that don't overlap with existing ecosystem tools, and signals that are genuinely hard to measure but matter to holders. None of this is planned. All of it is possible.

If you hold $CLAWD and have opinions on what should change, that conversation should happen in the open.`,
        },
        {
          heading: 'Do your own research',
          body: `The Build Report is a starting point, not a conclusion. Verify anything that matters to you against primary sources. Hold $CLAWD because you've done your own research, not because a score on this site told you to.`,
        },
      ].map(section => (
        <div key={section.heading} style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {section.heading}
          </h2>
          {section.body.split('\n\n').map((para, i) => (
            <p key={i} style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '10px' }}>
              {para}
            </p>
          ))}
        </div>
      ))}

      <div style={{
        marginTop: '32px',
        padding: '16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        fontSize: '13px',
        color: 'var(--text-muted)',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Disclaimer:</strong> This site is speculative and experimental. Scores are interpretive, not authoritative. No real-time onchain data is used. Numbers cited reflect publicly stated claims, not verified transaction volumes. This is not financial advice. This is not investment advice. Do your own research. The authors of this site may hold $CLAWD.
      </div>
    </div>
  )
}
