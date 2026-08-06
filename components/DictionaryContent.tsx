'use client'

import { useEffect } from 'react'
import DictionaryDefinition from '@/components/DictionaryDefinition'
import {
  DICTIONARY_ENTRIES,
  DICTIONARY_GROUPS,
  dictionaryEntriesInGroup,
} from '@/lib/dictionary'

export default function DictionaryContent() {
  // Honor hash on load / back-forward (client nav).
  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.replace(/^#/, '')
      if (!id) return
      const el = document.getElementById(id)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    scrollToHash()
    window.addEventListener('hashchange', scrollToHash)
    return () => window.removeEventListener('hashchange', scrollToHash)
  }, [])

  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Layman definitions for crypto, GitHub, coding, AI, and ops words that show up in score
        explanations. Hover or tap a linked term for a quick peek; use See here to jump to the full
        entry. Separate from the Start Here glossary (site UI terms) — overlap is fine.
      </p>

      <nav
        aria-label="Dictionary sections"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 14px',
          margin: '0 0 20px',
          fontSize: '12px',
        }}
      >
        {DICTIONARY_GROUPS.map(g => (
          <a key={g.id} href={`#group-${g.id}`} style={{ color: 'var(--accent)' }}>
            {g.label}
          </a>
        ))}
      </nav>

      <div style={{ margin: '0 0 20px' }}>
        <input
          type="search"
          placeholder="Filter terms…"
          id="dictionary-filter"
          onChange={e => {
            const q = e.target.value.trim().toLowerCase()
            for (const entry of DICTIONARY_ENTRIES) {
              const el = document.getElementById(entry.id)
              if (!el) continue
              const hay = `${entry.term} ${entry.short} ${entry.definition}`.toLowerCase()
              el.style.display = !q || hay.includes(q) ? '' : 'none'
            }
            for (const g of DICTIONARY_GROUPS) {
              const section = document.getElementById(`group-${g.id}`)
              if (!section) continue
              const visible = dictionaryEntriesInGroup(g.id).some(en => {
                const el = document.getElementById(en.id)
                return el && el.style.display !== 'none'
              })
              section.style.display = visible ? '' : 'none'
            }
          }}
          style={{
            width: '100%',
            maxWidth: 360,
            padding: '8px 10px',
            fontSize: '13px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {DICTIONARY_GROUPS.map(group => {
        const entries = dictionaryEntriesInGroup(group.id)
        if (!entries.length) return null
        return (
          <section key={group.id} id={`group-${group.id}`} style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: '15px',
                fontWeight: 600,
                margin: '0 0 4px',
                color: 'var(--text-primary)',
              }}
            >
              {group.label}
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {group.blurb}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {entries.map(entry => (
                <article
                  key={entry.id}
                  id={entry.id}
                  style={{
                    scrollMarginTop: 72,
                    padding: '12px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface-1)',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      margin: '0 0 6px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {entry.term}
                  </h3>
                  <p
                    style={{
                      margin: '0 0 8px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      lineHeight: 1.45,
                      fontStyle: 'italic',
                    }}
                  >
                    {entry.short}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.55,
                    }}
                  >
                    <DictionaryDefinition definition={entry.definition} inPage />
                  </p>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
