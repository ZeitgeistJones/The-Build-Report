import Link from 'next/link'
import CollapsibleSection from '@/components/CollapsibleSection'
import FirstVisitChecklist from '@/components/FirstVisitChecklist'
import {
  START_HERE_ANALOGIES,
  START_HERE_DISCLAIMER,
  START_HERE_GLOSSARY,
  START_HERE_SECTIONS,
  START_HERE_TOC,
} from '@/lib/startHereContent'

const PROSE_STYLE = {
  margin: 0,
  fontSize: '13px',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
} as const

function CalloutBox({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        marginTop: '12px',
        padding: '10px 12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
        {title}
      </div>
      <p style={{ ...PROSE_STYLE, fontSize: '12px' }}>{body}</p>
    </div>
  )
}

function AnalogyDetails({ label, text }: { label: string; text: string }) {
  return (
    <details style={{ marginTop: '10px' }}>
      <summary
        style={{
          fontSize: '12px',
          color: 'var(--accent)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        Plain English: {label}
      </summary>
      <p style={{ ...PROSE_STYLE, fontSize: '12px', marginTop: '8px' }}>{text}</p>
    </details>
  )
}

function ProseBlock({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((paragraph, i) => (
        <p key={i} style={{ ...PROSE_STYLE, marginTop: i === 0 ? 0 : '12px' }}>
          {paragraph}
        </p>
      ))}
    </>
  )
}

function GlossaryTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              Term
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              Meaning
            </th>
          </tr>
        </thead>
        <tbody>
          {START_HERE_GLOSSARY.map(row => (
            <tr key={row.term}>
              <td
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  verticalAlign: 'top',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.term}
              </td>
              <td
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  verticalAlign: 'top',
                }}
              >
                {row.definition}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TOKEN_SECTION_ANALOGIES = START_HERE_ANALOGIES.filter(a =>
  ['Burn', 'Burn vs supply-lock', 'CV (conviction)'].includes(a.label),
)

export default function StartHereContent() {
  return (
    <>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Read in order the first time. After that, jump to the{' '}
        <a href="#sh-walkthrough" style={{ color: 'var(--accent)' }}>
          3-minute walkthrough
        </a>{' '}
        or{' '}
        <a href="#sh-glossary" style={{ color: 'var(--accent)' }}>
          glossary
        </a>{' '}
        anytime.
      </p>

      <FirstVisitChecklist />

      <nav
        aria-label="Start Here sections"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 12px',
          marginBottom: '20px',
          fontSize: '12px',
        }}
      >
        {START_HERE_TOC.map(link => (
          <a key={link.href} href={link.href} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            {link.label}
          </a>
        ))}
      </nav>

      {START_HERE_SECTIONS.map(section => {
        if (section.id === 'sh-glossary') {
          return (
            <CollapsibleSection
              key={section.id}
              id={section.id}
              title={section.title}
              subtitle={section.subtitle}
            >
              <GlossaryTable />
            </CollapsibleSection>
          )
        }

        if (section.disclaimer) {
          return (
            <CollapsibleSection key={section.id} id={section.id} title={section.title}>
              <blockquote
                style={{
                  margin: 0,
                  padding: '12px 14px',
                  borderLeft: '3px solid var(--border)',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {START_HERE_DISCLAIMER.map((paragraph, i) => (
                  <p
                    key={i}
                    style={{
                      ...PROSE_STYLE,
                      fontSize: '12px',
                      marginTop: i === 0 ? 0 : '10px',
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
              </blockquote>
            </CollapsibleSection>
          )
        }

        const inner = (
          <>
            {section.body && <ProseBlock text={section.body} />}
            {section.subsections?.map(sub => (
              <div key={sub.title} style={{ marginTop: section.body ? '16px' : 0 }}>
                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {sub.title}
                </h3>
                <ProseBlock text={sub.body} />
                {sub.analogy && <AnalogyDetails label={sub.analogy.label} text={sub.analogy.text} />}
              </div>
            ))}
            {section.id === 'sh-token' &&
              TOKEN_SECTION_ANALOGIES.map(a => (
                <AnalogyDetails key={a.label} label={a.label} text={a.text} />
              ))}
            {section.callouts?.map(c => (
              <CalloutBox key={c.title} title={c.title} body={c.body} />
            ))}
            {section.id === 'sh-what' && (
              <p style={{ ...PROSE_STYLE, marginTop: '12px', fontSize: '12px' }}>
                <Link href="/about" style={{ color: 'var(--accent)' }}>
                  About The Build Report ↗
                </Link>
                {' · '}
                <Link href="/how-we-score" style={{ color: 'var(--accent)' }}>
                  How we score ↗
                </Link>
              </p>
            )}
          </>
        )

        if (section.walletSidebar) {
          return (
            <CollapsibleSection
              key={section.id}
              id={section.id}
              title={section.title}
              subtitle={section.subtitle}
            >
              <div
                style={{
                  padding: '14px 16px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {inner}
                <AnalogyDetails
                  label="Rescore fee"
                  text="A tiny toll that gets converted into a $CLAWD burn — you're paying for a fresh look, and the ecosystem gets a supply cut as a side effect."
                />
              </div>
            </CollapsibleSection>
          )
        }

        return (
          <CollapsibleSection
            key={section.id}
            id={section.id}
            title={section.title}
            subtitle={section.subtitle}
            defaultOpen={section.defaultOpen}
          >
            {inner}
          </CollapsibleSection>
        )
      })}
    </>
  )
}
