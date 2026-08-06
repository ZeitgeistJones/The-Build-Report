'use client'

import Link from 'next/link'
import InfoTooltip from '@/components/InfoTooltip'
import { getDictionaryEntry } from '@/lib/dictionary'

/**
 * Inline dictionary cross-ref: tooltip with short definition + “See here” to full entry.
 * Does not link to the Start Here glossary.
 */
export default function DictionaryTermRef({
  id,
  /** When on /dictionary, jump in-page; otherwise go to /dictionary#id */
  inPage = false,
}: {
  id: string
  inPage?: boolean
}) {
  const entry = getDictionaryEntry(id)
  if (!entry) {
    return <span style={{ color: 'var(--text-muted)' }}>[{id}]</span>
  }

  const href = inPage ? `#${entry.id}` : `/dictionary#${entry.id}`

  return (
    <span
      style={{
        display: 'inline',
        whiteSpace: 'nowrap',
      }}
    >
      <InfoTooltip
        interactive
        width={280}
        ariaLabel={`${entry.term}: ${entry.short}`}
        textTrigger={entry.term}
        content={
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {entry.term}
            </div>
            <div style={{ marginBottom: 8 }}>{entry.short}</div>
            <Link
              href={href}
              style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 500 }}
              onClick={e => e.stopPropagation()}
            >
              See here →
            </Link>
          </div>
        }
      />
    </span>
  )
}
