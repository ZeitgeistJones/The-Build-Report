import Link from 'next/link'
import { CHANGELOG } from '@/lib/scores'
import { TAG_TOOLTIPS, LIFECYCLE_TOOLTIPS } from '@/lib/badgeTooltips'
import { neutralBadgeStyle, TAG_LABELS } from '@/lib/repoVisualStyles'
import type { Tag } from '@/lib/scores'
import type { ChronicleBannerData } from '@/lib/chronicle'
import CollapsibleSection from '@/components/CollapsibleSection'
import HowWeScoreRubrics from '@/components/HowWeScoreRubrics'
import ChronicleSection from '@/components/ChronicleSection'
import ScoringContextSection from '@/components/ScoringContextSection'

const CARD_STYLE = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '14px 16px',
} as const

const H2_STYLE = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: '28px 0 12px',
  letterSpacing: '-0.01em',
} as const

type TocLink = { href: string; label: string }

function buildTocLinks(chronicle: ChronicleBannerData | null, communityContextEnabled: boolean): TocLink[] {
  const links: TocLink[] = [
    { href: '#hw-score-rubrics', label: 'Rubrics' },
    { href: '#hw-score-grades', label: 'Ecosystem Grades' },
  ]
  if (communityContextEnabled) {
    links.push({ href: '#hw-score-community', label: 'Community context' })
  }
  if (chronicle?.lastUpdated || chronicle?.summary) {
    links.push({ href: '#chronicle', label: 'Latest Chronicle' })
  }
  links.push(
    { href: '#hw-score-layers', label: 'Context layers' },
    { href: '#context', label: 'Scoring context' },
    { href: '#hw-score-brief', label: 'Build brief' },
    { href: '#hw-score-activity', label: 'Activity' },
    { href: '#hw-score-scale', label: 'Letter scale' },
    { href: '#hw-score-tags', label: 'Tags' },
    { href: '#hw-score-changelog', label: 'Changelog' },
  )
  return links
}

function TocNav({
  chronicle,
  communityContextEnabled,
}: {
  chronicle: ChronicleBannerData | null
  communityContextEnabled: boolean
}) {
  const links = buildTocLinks(chronicle, communityContextEnabled)
  return (
    <nav
      aria-label="How we score sections"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 12px',
        marginBottom: '20px',
        fontSize: '12px',
      }}
    >
      {links.map(link => (
        <a
          key={link.href}
          href={link.href}
          style={{ color: 'var(--accent)', textDecoration: 'none' }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}

const TAG_PILLS: { tag: Tag; label: string }[] = [
  { tag: 'direct', label: TAG_LABELS.direct },
  { tag: 'supply-lock', label: TAG_LABELS['supply-lock'] },
  { tag: 'indirect', label: TAG_LABELS.indirect },
  { tag: 'infrastructure', label: TAG_LABELS.infrastructure },
  { tag: 'theoretical', label: TAG_LABELS.theoretical },
]

interface Props {
  chronicle: ChronicleBannerData | null
  scoringContextText: string
  scoringContextOverride: boolean
  communityContextEnabled?: boolean
}

export default function HowWeScoreContent({
  chronicle,
  scoringContextText,
  scoringContextOverride,
  communityContextEnabled = false,
}: Props) {
  return (
    <>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
        Three Ecosystem Grades at the top, plus Repo Grades on each card. Together they answer: is the builder
        shipping, does value flow to holders, and how do repos score on safety and transparency?
      </p>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '16px' }}>
        Grades come from{' '}
        <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>launch baseline</strong>{' '}
        (fixed Jun 15 snapshot) or{' '}
        <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>live AI</strong>{' '}
        (auto-inferred or paid Rescore). Live AI reads{' '}
        <a href="#context" style={{ color: 'var(--accent)' }}>scoring context</a> — rules, repo cheat sheet, and Chronicle
        timeline — plus each repo&apos;s GitHub files. See{' '}
        <Link href="/about#score-types" style={{ color: 'var(--accent)' }}>About → Score types</Link>.
      </p>

      <TocNav chronicle={chronicle} communityContextEnabled={communityContextEnabled} />

      <h2 style={{ ...H2_STYLE, marginTop: 0 }}>Scoring methodology</h2>
      <HowWeScoreRubrics />

      <section id="hw-score-grades" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Ecosystem Grades
        </h3>
        <div className="how-we-score-card" style={{ ...CARD_STYLE, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            <li>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Builder activity</strong> — GitHub velocity across ~150–200 repos (
              <a href="#hw-score-rubrics" style={{ color: 'var(--accent)' }}>see rubric</a>
              ). Not on repo cards.
              <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Fixed targets tuned to this org&apos;s recent shipping pace — compares velocity to those benchmarks, not
                per-repo quality. Rolling baselines planned.
              </span>
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Holder economics</strong> — commit-weighted average of the direct-burn and supply-lock repos; infra excluded (
              <a href="#hw-score-rubrics" style={{ color: 'var(--accent)' }}>see rubric</a>
              ). When less than 20% of a window&apos;s commits land on holder-facing repos, the grade is scaled down (to a floor of 0.35×) to reflect thin holder attention — the unadjusted quality number is kept separately.
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Builder standards</strong> — commit-weighted rubric quality across all scored repos, including infrastructure (
              <a href="#hw-score-rubrics" style={{ color: 'var(--accent)' }}>see rubric</a>
              ).
            </li>
          </ul>
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Use the period toggle (7d / 30d / 60d) on the Ecosystem Grades panel. Repos with more commits in the window weigh more in economic and builder-standards blends.
          </p>
        </div>
      </section>

      {communityContextEnabled && (
        <section id="hw-score-community" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Community context
          </h3>
          <div className="how-we-score-card" style={{ ...CARD_STYLE, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>
              Holders can submit real-world context on a repo — onchain state, governance, or utility that GitHub activity
              cannot show. Submitting burns a small amount of CLAWD; voting is free for holders. Enough net upvotes
              auto-accepts context, which the AI then reads on the next paid rescore.
            </p>
            <p style={{ margin: '10px 0 0', fontWeight: 500, color: 'var(--text-primary)', fontSize: '12px' }}>
              How to add context
            </p>
            <ol style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <li style={{ marginBottom: '4px' }}>Find the repo on the homepage.</li>
              <li style={{ marginBottom: '4px' }}>Expand the card.</li>
              <li style={{ marginBottom: '4px' }}>Submit context (small CLAWD burn) — voting is free for holders.</li>
              <li>Accepted context is read on the next paid rescore.</li>
            </ol>
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Sources are encouraged — context with no source is labeled &quot;No source provided.&quot; Accepted context is
              grounding the AI weighs, not a direct score override. See{' '}
              <a href="#hw-score-layers" style={{ color: 'var(--accent)' }}>how context layers work</a>. Every submission,
              its votes, and its acceptance are public and permanently logged.
            </p>
          </div>
        </section>
      )}

      <h2 style={H2_STYLE}>Context and grounding</h2>

      <section id="hw-score-layers" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          How scoring context layers work
        </h3>
        <div
          className="how-we-score-card"
          style={{
            ...CARD_STYLE,
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            borderColor: 'var(--accent-border)',
            background: 'var(--surface-2)',
          }}
        >
          <ol style={{ margin: 0, paddingLeft: '18px' }}>
            <li style={{ marginBottom: '6px' }}>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Repo files</strong> — README, tests, CI,
              SECURITY.md (builder standards rows).
            </li>
            <li style={{ marginBottom: '6px' }}>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Scoring handbook</strong> — rules, repo
              cheat sheet, Chronicle timeline below (economics, tags, the direct-burn vs shipping-leverage lens for holder economics).
            </li>
            <li>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Community submissions</strong> — holder
              tips with sources; weighed on rescore, not guaranteed to move the letter.
            </li>
          </ol>
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            <strong style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>When they disagree:</strong> repo files
            win on safety and testing claims; the handbook wins on economic story unless community cites verifiable
            on-chain facts.
          </p>
        </div>
      </section>

      <ChronicleSection chronicle={chronicle} />
      <ScoringContextSection activeText={scoringContextText} usingOverride={scoringContextOverride} />

      <h2 style={H2_STYLE}>Reference</h2>
      <section
        id="hw-score-brief"
        className="how-we-score-card"
        style={{
          marginBottom: '16px',
          ...CARD_STYLE,
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Build brief
        </h3>
        <p style={{ margin: 0 }}>
          Daily AI summary above Grades — what repos moved in the last 24h and what kind of work landed. Generated after the autoscore cron from commit messages.
        </p>
      </section>

      <section
        id="hw-score-activity"
        style={{
          marginBottom: '20px',
          padding: '12px 14px',
          background: 'var(--surface-2)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius)',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Activity counts
        </h3>
        <p style={{ margin: 0, fontSize: '12px' }}>
          <strong style={{ fontWeight: 500 }}>Activity ·</strong> next to Grades — counts repos that are{' '}
          {LIFECYCLE_TOOLTIPS.shipping.split('.')[0].toLowerCase()}, stable, or done. Context only, not a letter grade.
        </p>
      </section>

      <section id="hw-score-scale" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Letter grade scale
        </h3>
        <div className="how-we-score-card" style={CARD_STYLE}>
          <div className="letter-grade-scale" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            A+ 97–100 · A 93–96 · A- 90–92 · B+ 87–89 · B 83–86 · B- 80–82 · C+ 77–79 · C 73–76 · C- 70–72 · D+ 67–69 · D 63–66 · D- 60–62 · F+ 50–59 · F 40–49 · F- below 40
          </div>
        </div>
      </section>

      <section id="hw-score-tags" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Repo tags
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.5 }}>
          Tag picks which holder-economics lens applies — direct/supply-lock are scored on their direct CLAWD burn or lock; infra/indirect/theoretical on shipping leverage. Every repo gets builder standards.{' '}
          <a href="#hw-score-rubrics" style={{ color: 'var(--accent)' }}>Row definitions →</a>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {TAG_PILLS.map(t => (
            <span
              key={t.tag}
              title={TAG_TOOLTIPS[t.tag]}
              style={neutralBadgeStyle()}
            >
              {t.label}
            </span>
          ))}
        </div>
      </section>

      <CollapsibleSection id="hw-score-changelog" title="Score changelog" subtitle="Historical methodology and score updates">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '12px' }}>
          {CHANGELOG.map((entry, i) => (
            <div key={i} className="changelog-row" style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
              <span
                style={{
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  minWidth: '80px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                }}
              >
                {entry.date}
              </span>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{entry.note}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Scores are interpretive — launch baseline grades are a fixed snapshot; live AI scores update via Rescore. This is an
        independent community project, not an official builder source.
      </p>
    </>
  )
}
