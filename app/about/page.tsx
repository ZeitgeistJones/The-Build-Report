import { isCommunityContextEnabled } from '@/lib/communityContext'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'About — The Build Report',
  description:
    'What The Build Report is, what each nav tab covers, and how to trust (and challenge) the scores.',
}

export default function AboutPage() {
  const communityContextEnabled = isCommunityContextEnabled()
  const sections = [
    {
      heading: 'What this is',
      body: `The Build Report is an independent community project tracking what clawdbotatg is building on GitHub and scoring each repo on builder standards plus either holder economics (direct burn / supply lock) or shipping leverage (infra / tooling) — sibling holder-value grades by repo type — with ecosystem-wide builder activity from GitHub signals at the top.

It is not affiliated with clawdbotatg, Austin Griffith, or any core team. It was built by a community member who holds $CLAWD and wanted a clearer picture of what was being built and why.

New here? Start with Start Here for how to read the homepage. Want the detailed “why” behind a letter? Open How we score.`,
    },
    {
      heading: 'What this is not',
      body: `This is not financial advice. Nothing on this site should be used as the basis for any investment decision.

This is not an official source. Scores are interpretive. They reflect one reading of publicly available information — clawdbotatg's tweets, the Chronicle, and GitHub activity — and reasonable people could score the same repos differently.

This is not a real-time data feed. Launch baseline grades are a fixed Jun 15 snapshot. GitHub activity refreshes automatically. Live AI scores update when someone pays for a Rescore or when batch autoscore runs.`,
    },
    {
      heading: 'What’s in the tabs',
      body: `Repos is the main Build Report — ecosystem grades, repo cards, the clawdbotatg “Yesterday’s build” digest, and overnight rescores. That’s the scored ledger.

Yesterday’s Builds (nav) is a separate overnight newspaper for other GitHub projects we track outside clawdbotatg. Unofficial shipping digests only — no grades, not affiliated with those projects. Not the same as the homepage clawdbotatg brief.

Archives keeps past clawdbotatg Build Briefs for about 90 days. Brief-only.

Night Sky is a full-screen visual map of the same ecosystem: repos as stars, grouped by theme. Orientation, not a second scoreboard.

Start Here is the plain-English onboarding guide — how to read grades, activity, filters, and basic token concepts.

Dictionary defines jargon in score blurbs and commit language. Start Here’s glossary is for site UI terms; use Dictionary for code-ish words.

How we score is the methodology handbook — rubrics, grade math, evidence rules, Chronicle context, and changelog.

About (this page) is identity, disclaimers, and this tab map — not the homepage walkthrough or the full scoring math.`,
    },
    {
      heading: 'Scores & overnight rescore',
      body: `Repo grades refresh overnight when tracked repos ship (and operators can rescore from Admin). Results are cached and shared. Rubric weights, evidence rules, and context layers live in How we score.`,
    },
    ...(communityContextEnabled
      ? [
          {
            heading: 'Community context',
            body: `Holders can submit real-world context on any repo — onchain state, governance changes, or utility that GitHub alone cannot show. Submitting burns a small amount of CLAWD; voting is free for CLAWD holders. Accepted context grounds the next rescore; it is not a silent score override. Details and conflict rules: How we score → Context layers.`,
          },
        ]
      : []),
    {
      heading: 'Important distinctions',
      body: `CV burns are not CLAWD burns. Burning ClawdViction points removes governance tokens, not $CLAWD itself.

Supply lock is not a burn. Locking CLAWD removes it from circulation temporarily — it can return. A burn permanently destroys tokens.

Infrastructure / tooling / theoretical repos are scored on Shipping leverage (not direct burn), and that lens rolls up into its own Ecosystem Grade beside Holder economics. All repos still get Builder standards.`,
    },
    {
      heading: 'Sources',
      body: `Scores draw on publicly available information: the clawdbotatg Chronicle, public Twitter/X history, and github.com/clawdbotatg. The Chronicle is the primary grounding document. How we score documents how that evidence is used.`,
    },
    {
      heading: 'Corrections and disagreements',
      body: `If you think a score is wrong, that conversation should happen in the open. The live methodology — rubrics, weights, and changelog — is on How we score. Admin notes can be added to cards for context; scores are not changed quietly.

Older baseline cards may still show an earlier Builder standards shape; live AI Score/Rescore uses the current handbook. This is a speculative, experimental community project. It will have errors. The goal is to be honest about the limits of what it knows.`,
    },
    {
      heading: 'What could come next',
      body: `This is a v1. Categories and weights were developed quickly with AI-assisted research — a reasonable first attempt, not a final methodology.

Future directions could include community rubric proposals, richer commit meaning analysis, formal score disputes, and clearer holder participation. None of this is committed. If you hold $CLAWD and have opinions, say them in the open.`,
    },
    {
      heading: 'Do your own research',
      body: `The Build Report is a starting point, not a conclusion. Verify anything that matters against primary sources. Hold $CLAWD because you've done your own research, not because a score on this site told you to.`,
    },
  ]

  const linkStyle = { color: 'var(--accent)' as const }

  function linkify(text: string): ReactNode[] {
    const parts: ReactNode[] = []
    const pattern =
      /(Start Here|How we score|Dictionary|Yesterday’s Builds|Night Sky|Archives|Repos)/g
    let last = 0
    let match: RegExpExecArray | null
    let key = 0
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) parts.push(text.slice(last, match.index))
      const label = match[1]
      const href =
        label === 'Start Here'
          ? '/start'
          : label === 'How we score'
            ? '/how-we-score'
            : label === 'Dictionary'
              ? '/dictionary'
              : label === 'Yesterday’s Builds'
                ? '/yesterdays-builds'
                : label === 'Night Sky'
                  ? '/sky'
                  : label === 'Archives'
                    ? '/archives'
                    : '/'
      parts.push(
        <a key={key++} href={href} style={linkStyle}>
          {label}
        </a>,
      )
      last = match.index + label.length
    }
    if (last < text.length) parts.push(text.slice(last))
    return parts
  }

  return (
    <div className="about-prose" style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '8px' }}>
          About The Build Report
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Identity, tab map, and trust — not the homepage walkthrough or the scoring handbook.
        </p>
      </div>

      {sections.map(section => (
        <div
          key={section.heading}
          id={section.heading === 'Scores & overnight rescore' ? 'score-types' : undefined}
          className="about-prose-section"
          style={{ marginBottom: '28px' }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {section.heading}
          </h2>
          {section.body.split('\n\n').map((para, i) => (
            <p
              key={i}
              style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '10px' }}
            >
              {linkify(para)}
            </p>
          ))}
        </div>
      ))}

      <div
        style={{
          marginTop: '32px',
          padding: '16px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: '13px',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: 'var(--text-secondary)' }}>Disclaimer:</strong> This site is speculative
        and experimental. Scores are interpretive, not authoritative. No real-time onchain data is used.
        Numbers cited reflect publicly stated claims, not verified transaction volumes. This is not
        financial advice. This is not investment advice. Do your own research. The authors of this site
        may hold $CLAWD.
      </div>
    </div>
  )
}
