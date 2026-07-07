import {
  ABOUT_SCORE_TYPES_CALLOUT,
  ABOUT_SCORE_TYPES_SECTIONS,
} from '@/lib/scoringCopy'
import { isCommunityContextEnabled } from '@/lib/communityContext'

export const metadata = {
  title: 'About — The Build Report',
  description:
    'What The Build Report is, how launch baseline and live AI scores differ, and how holders can submit community context.',
}

export default function AboutPage() {
  const communityContextEnabled = isCommunityContextEnabled()
  const sections = [
    {
      heading: 'What this is',
      body: `The Build Report is an independent community project tracking what clawdbotatg is building on GitHub and scoring each repo on three axes: holder economics (holder economic impact — scored through a direct-burn or shipping-leverage lens depending on repo type), builder standards (observable safety, testing, and transparency rubrics), and ecosystem-wide builder activity from GitHub signals.

It is not affiliated with clawdbotatg, Austin Griffith, or any core team. It was built by a community member who holds $CLAWD and wanted a clearer picture of what was being built and why.`,
    },
    {
      heading: 'What this is not',
      body: `This is not financial advice. Nothing on this site should be used as the basis for any investment decision.

This is not an official source. Scores are interpretive. They reflect one reading of publicly available information — clawdbotatg's tweets, the Chronicle, and GitHub activity — and reasonable people could score the same repos differently.

This is not a real-time data feed. Launch baseline grades are a fixed Jun 15 snapshot. GitHub activity refreshes automatically. Live AI scores update when someone pays for a Rescore or when batch autoscore runs.`,
    },
    {
      heading: 'How scores are assigned',
      body: '',
    },
    {
      heading: 'Score types',
      body: '',
    },
    {
      heading: 'Score & Rescore',
      body: `Every repo card has a Score or Rescore button. It runs Claude AI inference for that single repo — useful for repos that have not been scored yet, or to refresh a live AI score.

Cost: 0.000008 ETH per score. When you pay, ETH goes to the receiver-buy-and-burn contract (0x0C1a3DB07304D2E4E551AB4A7b083382a33f25ad). CLAWD is destroyed when someone calls execute() on that contract. The homepage shows on-chain CLAWD burned, pending ETH, and a button to trigger the batch burn.

Who can use it: any wallet that passes CLAWDGate tier 1 on Base (10M+ $CLAWD). The full report blur gate uses the same check.

Result is shared: once a repo is scored, the result is cached in Redis and everyone sees it for free — including visitors who have not connected a wallet.

Live AI scores read Chronicle-grounded scoring context on the How we score page, plus each repo's GitHub files.`,
    },
    ...(communityContextEnabled
      ? [
          {
            heading: 'Community context',
            body: `Holders can submit real-world context on any repo — onchain state (e.g. a burn contract turning back on), governance changes, or utility that GitHub activity cannot show. Submitting burns a small amount of CLAWD; voting is free for CLAWD holders.

Other holders vote it up or down. Enough net upvotes auto-accepts the context, which the AI then reads on the next paid rescore. Sources are encouraged — context with no source is labeled "No source provided" so voters can weigh it, and anyone can downvote fabricated claims.

Accepted context is grounding the AI weighs, not a direct score override. On conflicts, repo files and the scoring handbook lead unless community cites verifiable on-chain facts — see How we score → Context layers. Every submission, its votes, and its acceptance are public and permanently logged. Context that influences a score is visible on the repo card before and after it is read by a rescore.`,
          },
        ]
      : []),
    {
      heading: 'Important distinctions',
      body: `CV burns are not CLAWD burns. Burning ClawdViction points removes governance tokens, not $CLAWD itself.

Supply lock is not a burn. Locking CLAWD in a staking or vesting contract removes it from circulation temporarily — it can return. A burn permanently destroys tokens. Both are meaningful but they are not the same thing.

Infrastructure repos are not expected to have direct burn or revenue mechanics. Their Repo Grade for holder economics is scored on shipping leverage instead — how much they multiply the builder's ability to ship consumer apps — and rolls up into its own Shipping leverage Ecosystem Grade at the top, a separate lens from Holder economics rather than being dropped from the averages. All repos are scored on builder standards.`,
    },
    {
      heading: 'Sources',
      body: `All scores are sourced from publicly available information: the clawdbotatg Chronicle (Jan 25 – Apr 10, 2026), clawdbotatg's public Twitter/X history, and the public GitHub account at github.com/clawdbotatg.

The Chronicle is the primary grounding document. Where a score references a tweet, the tweet text and approximate date are cited. Nothing is claimed without a source.`,
    },
    {
      heading: 'Corrections and disagreements',
      body: `If you think a score is wrong, that conversation should happen in the open. The scoring methodology is fully documented on the main page. Admin notes can be added to any card for context — scores themselves are not changed quietly.

One known v1 limitation: the 'Agent-authored build' criterion under Builder standards (legacy 3-row rubric) infers autonomous coding patterns from repo metadata alone. The human collaborator's role is infrastructure and multisig signing, not code authorship — low scores here reflect inference uncertainty from limited metadata, not evidence of human coding involvement.

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
  ]

  return (
    <div className="about-prose" style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '8px' }}>
          About The Build Report
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          A plain English look at the repos, scored and sourced.
        </p>
      </div>

      {sections.map(section => (
        <div
          key={section.heading}
          id={section.heading === 'Score types' ? 'score-types' : undefined}
          className="about-prose-section"
          style={{ marginBottom: '28px' }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {section.heading}
          </h2>
          {section.heading === 'How scores are assigned' ? (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '10px' }}>
              For the full scoring methodology including rubric weights, grade calculations, and period definitions, see{' '}
              <a href="/how-we-score" style={{ color: 'var(--accent)' }}>How we score ↗</a>.
            </p>
          ) : section.heading === 'Score types' ? (
            <>
              {ABOUT_SCORE_TYPES_SECTIONS.map(({ title, body }) => (
                <div key={title} style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {title}
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                    {body}
                  </p>
                </div>
              ))}
              <div style={{
                marginTop: '12px',
                padding: '12px 14px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}>
                {ABOUT_SCORE_TYPES_CALLOUT}
              </div>
            </>
          ) : (
            section.body.split('\n\n').map((para, i) => (
              <p key={i} style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '10px' }}>
                {para}
              </p>
            ))
          )}
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
