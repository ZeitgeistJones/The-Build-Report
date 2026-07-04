import Link from 'next/link'
import { CHANGELOG } from '@/lib/scores'
import { TAG_TOOLTIPS, LIFECYCLE_TOOLTIPS } from '@/lib/badgeTooltips'
import CollapsibleSection from '@/components/CollapsibleSection'

const CARD_STYLE = {
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '14px 16px',
} as const

const TOC_LINKS = [
  { href: '#hw-score-grades', label: 'Ecosystem grades' },
  { href: '#hw-score-pulse', label: 'Ecosystem pulse' },
  { href: '#hw-score-repos', label: 'Repo card scores' },
  { href: '#hw-score-scale', label: 'Letter scale' },
  { href: '#hw-score-rubrics', label: 'Rubrics' },
  { href: '#hw-score-tags', label: 'Tags' },
  { href: '#hw-score-changelog', label: 'Changelog' },
]

const ECOSYSTEM_GRADES = [
  {
    name: 'Builder activity',
    description: 'Recent GitHub activity quality across the selected window.',
    detail:
      'Ecosystem-wide letter grade from GitHub signals — commits, active days, new repos, and consistency. Not shown on individual repo cards.',
  },
  {
    name: 'Burn apps (economic)',
    description:
      'Burn-app economic scores only — infra and tools excluded from this average.',
    detail:
      'Commit-weighted average of token mechanic scores for direct and supply-lock repos. Repos with more commits in the window carry more weight. Tags classify repos; they are not direct grade inputs.',
  },
  {
    name: 'Builder integrity',
    description:
      'Commit-weighted trust & safety on consumer apps and supply-lock repos (infra excluded).',
    detail:
      'Ecosystem-wide blend of per-repo integrity scores, weighted by commits in the selected period.',
  },
]

const RUBRIC_BLOCKS = [
  {
    title: 'Token mechanic — consumer apps (direct, supply-lock)',
    rows: [
      { label: 'Direct CLAWD economic impact', weight: '50%' },
      { label: 'Mechanism clarity and holder relevance', weight: '30%' },
      { label: 'Alignment with CLAWD economic story', weight: '20%' },
    ],
    note:
      'Measures CLAWD-facing economic impact from repo evidence and Chronicle context. Each row rated low / mid / high; score = (weighted sum ÷ 3) × 100.',
  },
  {
    title: 'Shipping leverage — infra, indirect, theoretical',
    rows: [
      { label: 'Multiplies builder shipping capacity', weight: '40%' },
      { label: 'Downstream path to holder value', weight: '35%' },
      { label: 'Role in ecosystem workflow', weight: '25%' },
    ],
    note:
      'Replaces token mechanic for repos that enable shipping rather than burn CLAWD directly. Low direct burn is expected — score the multiplier effect on the autonomous-builder thesis.',
  },
  {
    title: 'Builder integrity — all repos (5 rows)',
    rows: [
      { label: 'On-chain commitments and constraints', weight: '22%' },
      { label: 'User funds, risk, and safety posture', weight: '20%' },
      { label: 'Transparency and verifiability', weight: '18%' },
      { label: 'Governance, token-economics, and ecosystem alignment', weight: '20%' },
      { label: 'Security, testing, and cryptographic rigor', weight: '20%' },
    ],
    note:
      'Measures builder trustworthiness. Rows scored high (100) / mid (67) / low (33), then weighted sum. CV is not CLAWD; supply lock is not a burn.',
  },
  {
    title: 'Builder activity — GitHub signals (ecosystem-wide)',
    rows: [
      { label: 'Total commits in window', weight: '20%' },
      { label: 'Active days in window', weight: '20%' },
      { label: 'New repos created', weight: '20%' },
      { label: 'Repos with new commits', weight: '20%' },
      { label: 'Commit consistency ratio', weight: '20%' },
    ],
    note:
      'Measures whether clawdbotatg is alive and shipping across ~150–200 repos. Each signal = min(actual ÷ target, 1) × 20%. Not the same as token mechanic or per-repo integrity.',
  },
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

function UiMap() {
  const mapItem = (title: string, body: string) => (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '2px' }}>
        {body}
      </div>
    </div>
  )

  return (
    <div
      style={{
        ...CARD_STYLE,
        marginBottom: '24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '12px',
          }}
        >
          Grades panel (top of page)
        </div>
        {mapItem('Builder activity', 'Ecosystem-wide GitHub velocity — letter grade')}
        {mapItem('Burn apps (economic)', 'Commit-weighted consumer-app scores — letter grade')}
        {mapItem('Builder integrity', 'Commit-weighted trust scores — letter grade')}
        {mapItem('Pulse', 'Status counts (shipping / stable) — not a letter grade')}
      </div>
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '12px',
          }}
        >
          Each repo card
        </div>
        {mapItem('Tag pill', 'Which rubric applies (direct, infra, etc.)')}
        {mapItem('Token mechanic or shipping leverage', 'Per-repo economic score; infra shows N/A + display score')}
        {mapItem('Builder integrity', 'Per-repo trust score — every repo')}
        {mapItem('Baseline / Live AI badge', 'Launch snapshot vs AI-inferred score')}
      </div>
    </div>
  )
}

function RubricBlock({
  block,
}: {
  block: (typeof RUBRIC_BLOCKS)[number]
}) {
  return (
    <div
      style={{
        ...CARD_STYLE,
        marginTop: '12px',
        marginBottom: 0,
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '10px' }}>
        {block.title}
      </div>
      {block.rows.map(row => (
        <div
          key={row.label}
          className="rubric-weight-row"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '4px',
            gap: '12px',
          }}
        >
          <span>{row.label}</span>
          <span
            style={{
              fontWeight: 500,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              flexShrink: 0,
            }}
          >
            {row.weight}
          </span>
        </div>
      ))}
      <div
        style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}
      >
        {block.note}
      </div>
    </div>
  )
}

export default function HowWeScoreSection() {
  return (
    <div id="how-we-score" style={{ marginTop: '48px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
        How we score
      </h2>

      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
        Three ecosystem letter grades at the top, plus per-repo scores on each card. Together they answer: is the builder shipping, does value flow to holders, and can you trust the work?
      </p>

      <TocNav />
      <UiMap />

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '24px' }}>
        Grades come from{' '}
        <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>launch baseline</strong>{' '}
        (fixed Jun 15 snapshot) or{' '}
        <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>live AI</strong>{' '}
        (auto-inferred or paid Rescore). See{' '}
        <Link href="/about#score-types" style={{ color: 'var(--accent)' }}>About → Score types</Link>{' '}
        and <Link href="/context" style={{ color: 'var(--accent)' }}>scoring context</Link>.
      </p>

      <section id="hw-score-grades" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Ecosystem grades
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
          The three cards under <strong style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Grades</strong>.
          Use the period toggle (7d / 30d / 60d) to change the window — repos with more commits in that window carry more weight in economic and integrity blends.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ECOSYSTEM_GRADES.map(grade => (
            <div key={grade.name} style={CARD_STYLE}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {grade.name}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '6px' }}>
                {grade.description}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {grade.detail}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="hw-score-pulse"
        style={{
          marginBottom: '24px',
          padding: '14px 16px',
          background: 'var(--surface-2)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius)',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Ecosystem pulse
        </div>
        <p style={{ margin: 0 }}>
          Snapshot next to the <strong style={{ fontWeight: 500 }}>Grades</strong> header (labeled{' '}
          <strong style={{ fontWeight: 500 }}>Pulse ·</strong> on the page). Counts scored repos that are{' '}
          <strong style={{ fontWeight: 500 }}>shipping</strong> ({LIFECYCLE_TOOLTIPS.shipping.toLowerCase()}),{' '}
          <strong style={{ fontWeight: 500 }}>stable</strong> ({LIFECYCLE_TOOLTIPS.stable.toLowerCase()}), or{' '}
          <strong style={{ fontWeight: 500 }}>done</strong> ({LIFECYCLE_TOOLTIPS.done.toLowerCase()}).
          Quiet infra is stable, not a failure.{' '}
          <span style={{ color: 'var(--text-muted)' }}>This is context — not a letter grade.</span>
        </p>
      </section>

      <section id="hw-score-repos" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
          Repo card scores
        </h3>
        <div style={CARD_STYLE}>
          <ul
            style={{
              margin: 0,
              paddingLeft: '18px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
            }}
          >
            <li>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>direct / supply-lock</strong>{' '}
              → token mechanic rubric (CLAWD burn or lock impact)
            </li>
            <li>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>indirect / infrastructure / theoretical</strong>{' '}
              → shipping leverage rubric; economic column shows N/A with a display-only leverage score
            </li>
            <li>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Builder integrity</strong>{' '}
              → every repo, regardless of tag
            </li>
            <li>
              <strong style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Builder activity</strong>{' '}
              → ecosystem-only; not shown on individual cards
            </li>
          </ul>
          <div
            style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: 1.55,
            }}
          >
            Critical-path repos have locked tags and floor at C when functioning as designed.
            Card badges: <strong>Shipping</strong>, <strong>Stable</strong>, <strong>Done ✅</strong> — hover any pill on a card for detail.
          </div>
        </div>
      </section>

      <section id="hw-score-scale" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
          Letter grade scale
        </h3>
        <div style={CARD_STYLE}>
          <div className="letter-grade-scale" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            A+ 97–100 · A 93–96 · A- 90–92 · B+ 87–89 · B 83–86 · B- 80–82 · C+ 77–79 · C 73–76 · C- 70–72 · D+ 67–69 · D 63–66 · D- 60–62 · F+ 50–59 · F 40–49 · F- below 40
          </div>
        </div>
      </section>

      <CollapsibleSection
        id="hw-score-rubrics"
        title="Full rubric breakdown"
        subtitle="Weights and row definitions used by Live AI scoring"
      >
        {RUBRIC_BLOCKS.map(block => (
          <RubricBlock key={block.title} block={block} />
        ))}
      </CollapsibleSection>

      <section id="hw-score-tags" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
          Repo tags
        </h3>
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
        Primary source:{' '}
        <a href="https://github.com/clawdbotatg" target="_blank" rel="noopener noreferrer">
          github.com/clawdbotatg
        </a>{' '}
        and the clawdbotatg Chronicle. Scores are interpretive — launch baseline grades are a fixed snapshot; live AI scores update via Rescore. If you think a score is wrong, that conversation should happen in the open.
      </p>
    </div>
  )
}
