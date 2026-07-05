import Link from 'next/link'
import { CHANGELOG } from '@/lib/scores'
import { TAG_TOOLTIPS, LIFECYCLE_TOOLTIPS } from '@/lib/badgeTooltips'
import type { ChronicleBannerData } from '@/lib/chronicle'
import CollapsibleSection from '@/components/CollapsibleSection'
import HowWeScoreRubrics from '@/components/HowWeScoreRubrics'
import ChronicleSection from '@/components/ChronicleSection'
import ChronicleContextSection from '@/components/ChronicleContextSection'
import ScoringContextSection from '@/components/ScoringContextSection'

const CARD_STYLE = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '14px 16px',
} as const

const TOC_LINKS = [
  { href: '#hw-score-rubrics', label: 'Rubrics' },
  { href: '#hw-score-grades', label: 'Ecosystem grades' },
  { href: '#chronicle', label: 'Latest Chronicle' },
  { href: '#chronicle-context', label: 'Chronicle context' },
  { href: '#context', label: 'Ecosystem context' },
  { href: '#hw-score-brief', label: 'Build brief' },
  { href: '#hw-score-activity', label: 'Activity' },
  { href: '#hw-score-scale', label: 'Letter scale' },
  { href: '#hw-score-tags', label: 'Tags' },
  { href: '#hw-score-changelog', label: 'Changelog' },
]

const TAG_PILLS: { tag: string; label: string; color: string; bg: string }[] = [
  { tag: 'direct', label: 'direct', color: '#5cb87a', bg: 'rgba(92,184,122,0.1)' },
  { tag: 'supply-lock', label: 'supply lock', color: '#5b9bd5', bg: 'rgba(91,155,213,0.1)' },
  { tag: 'indirect', label: 'indirect', color: '#a07cd5', bg: 'rgba(160,124,213,0.1)' },
  { tag: 'infrastructure', label: 'infrastructure', color: 'var(--text-secondary)', bg: 'var(--surface-3)' },
  { tag: 'theoretical', label: 'theoretical', color: '#d4943a', bg: 'rgba(212,148,58,0.1)' },
]

function TocNav() {
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
      {TOC_LINKS.map(link => (
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

interface Props {
  chronicle: ChronicleBannerData | null
  chronicleContextText: string | null
  scoringContextText: string
  scoringContextOverride: boolean
}

export default function HowWeScoreContent({
  chronicle,
  chronicleContextText,
  scoringContextText,
  scoringContextOverride,
}: Props) {
  return (
    <>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
        Three ecosystem letter grades at the top, plus per-repo scores on each card. Together they answer: is the builder
        shipping, does value flow to holders, and can you trust the work?
      </p>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '16px' }}>
        Grades come from{' '}
        <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>launch baseline</strong>{' '}
        (fixed Jun 15 snapshot) or{' '}
        <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>live AI</strong>{' '}
        (auto-inferred or paid Rescore). Live AI reads{' '}
        <a href="#chronicle-context" style={{ color: 'var(--accent)' }}>Chronicle context</a> (optional admin paste) and{' '}
        <a href="#context" style={{ color: 'var(--accent)' }}>ecosystem context</a> before scoring each repo. See{' '}
        <Link href="/about#score-types" style={{ color: 'var(--accent)' }}>About → Score types</Link>.
      </p>

      <TocNav />
      <HowWeScoreRubrics />

      <section id="hw-score-grades" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Ecosystem grades
        </h3>
        <div style={{ ...CARD_STYLE, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            <li>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Builder activity</strong> — GitHub velocity across ~150–200 repos (
              <a href="#hw-score-rubrics" style={{ color: 'var(--accent)' }}>see rubric</a>
              ). Not on repo cards.
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Burn apps (economic)</strong> — commit-weighted token mechanic average; infra excluded (
              <a href="#hw-score-rubrics" style={{ color: 'var(--accent)' }}>see rubric</a>
              ).
            </li>
            <li style={{ marginTop: '6px' }}>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Builder integrity</strong> — commit-weighted trust blend on consumer apps + supply-lock (
              <a href="#hw-score-rubrics" style={{ color: 'var(--accent)' }}>see rubric</a>
              ).
            </li>
          </ul>
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Use the period toggle (7d / 30d / 60d) on the Grades panel. Repos with more commits in the window weigh more in economic and integrity blends.
          </p>
        </div>
      </section>

      <ChronicleSection chronicle={chronicle} />
      <ChronicleContextSection activeText={chronicleContextText} />
      <ScoringContextSection activeText={scoringContextText} usingOverride={scoringContextOverride} />

      <section
        id="hw-score-brief"
        style={{
          marginBottom: '16px',
          ...CARD_STYLE,
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Build brief
        </div>
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
        <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Activity counts
        </div>
        <p style={{ margin: 0, fontSize: '12px' }}>
          <strong style={{ fontWeight: 500 }}>Activity ·</strong> next to Grades — counts repos that are{' '}
          {LIFECYCLE_TOOLTIPS.shipping.split('.')[0].toLowerCase()}, stable, or done. Context only, not a letter grade.
        </p>
      </section>

      <section id="hw-score-scale" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Letter grade scale
        </h3>
        <div style={CARD_STYLE}>
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
          Tag picks which economic rubric applies — direct/supply-lock use token mechanic; infra/indirect/theoretical use shipping leverage. Every repo gets builder integrity.{' '}
          <a href="#hw-score-rubrics" style={{ color: 'var(--accent)' }}>Row definitions →</a>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {TAG_PILLS.map(t => (
            <span
              key={t.tag}
              title={TAG_TOOLTIPS[t.tag as keyof typeof TAG_TOOLTIPS]}
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '99px',
                color: t.color,
                background: t.bg,
                fontWeight: 500,
              }}
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
