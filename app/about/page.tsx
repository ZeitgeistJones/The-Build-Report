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

It is not affiliated with clawdbotatg, Austin Griffith, Anthropic, or any core team. It was built by a community member who holds $CLAWD and wanted a clearer picture of what was being built and why.`,
        },
        {
          heading: 'What this is not',
          body: `This is not financial advice. Nothing on this site should be used as the basis for any investment decision.

This is not an official source. Scores are interpretive. They reflect one reading of publicly available information — clawdbotatg's tweets, the Chronicle, and GitHub activity — and reasonable people could score the same repos differently.

This is not a real-time data feed. Scores are updated manually. GitHub activity data refreshes automatically but the scoring rubric and verdicts are human judgements, not automated outputs.`,
        },
        {
          heading: 'How scores are assigned',
          body: `Every repo receives up to two scores: holder relevance and builder integrity. Each score is built from three weighted components, each rated low / mid / high, with a cited source.

We score whether mechanisms exist and are live — not how much volume they've processed. That distinction matters. We do not have access to reliable real-time onchain data and we do not claim to. Any metric that would require live transaction data is outside the scope of this tool.

Scores are assigned against the goals clawdbotatg stated at the time a repo was built, not against where the project ended up. Goals change and a repo should not be penalised retroactively for a direction shift that came later.`,
        },
        {
          heading: 'Important distinctions',
          body: `CV burns are not CLAWD burns. Burning ClawdViction points removes governance tokens, not $CLAWD itself.

Supply lock is not a burn. Locking CLAWD in a staking or vesting contract removes it from circulation temporarily — it can return. A burn permanently destroys tokens. Both are meaningful but they are not the same thing.

Infrastructure repos are not expected to have burn or revenue mechanics. They are scored only on builder integrity.`,
        },
        {
          heading: 'Sources',
          body: `All scores are sourced from publicly available information: the clawdbotatg Chronicle (Jan 25 – Apr 10, 2026), clawdbotatg's public Twitter/X history, and the public GitHub account at github.com/clawdbotatg.

The Chronicle is the primary grounding document. Where a score references a tweet, the tweet text and approximate date are cited. Nothing is claimed without a source.`,
        },
        {
          heading: 'Corrections and disagreements',
          body: `If you think a score is wrong, that conversation should happen in the open. The scoring methodology is fully documented on the main page. Admin notes can be added to any card for context — scores themselves are not changed quietly.

This is a speculative, experimental community project. It will have errors. The goal is to be honest about the limits of what it knows.`,
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
