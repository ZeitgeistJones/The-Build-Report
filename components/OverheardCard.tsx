'use client'

import { useState } from 'react'
import type { OverheardEntry } from '@/lib/podcastMentions'
import type { OverheardDigest } from '@/lib/overheard'

interface Props {
  entry: OverheardEntry | null
  digest: OverheardDigest | null
}

function displayGuest(speaker: string | undefined): string | null {
  if (!speaker || speaker === 'unknown') return null
  const cleaned = speaker.replace(/^@/, '')
  return cleaned
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function buildEpisodeMeta(entry: OverheardEntry): string {
  const parts: string[] = []
  if (entry.episodeSlug) parts.push(entry.episodeSlug)

  const guest = displayGuest(entry.quotes[0]?.speaker)
  if (guest) parts.push(`guest: ${guest}`)
  else if (entry.episodeName) parts.push(entry.episodeName)

  if (entry.kind === 'thread' && entry.quotes.length > 1) {
    parts.push(`${entry.quotes.length} quotes`)
  }

  parts.push('Slop.Computer')
  return parts.join(' · ')
}

export default function OverheardCard({ entry, digest }: Props) {
  const [writeupExpanded, setWriteupExpanded] = useState(false)
  const [quotesExpanded, setQuotesExpanded] = useState(false)

  if (!entry) return null

  const writeupLong = entry.writeup.length > 180 || entry.writeup.split(/\s+/).length > 40
  const quotes = entry.quotes
  const visibleQuotes = quotesExpanded ? quotes : quotes.slice(0, 2)
  const hiddenQuoteCount = quotes.length - visibleQuotes.length

  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '10px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Overheard
        </span>
      </div>

      <header className="overheard-card__subject">
        <p className="overheard-card__featured-kicker">Featured repo</p>
        <p className="overheard-card__repo">{entry.repoSlug}</p>
        <p className="overheard-card__meta">{buildEpisodeMeta(entry)}</p>
      </header>

      <p className={`spotted-writeup${writeupExpanded || !writeupLong ? '' : ' spotted-writeup--clamped'}`}>
        {entry.writeup}
      </p>
      {writeupLong && (
        <button
          type="button"
          className="spotted-tweet-preview__link"
          onClick={() => setWriteupExpanded(v => !v)}
          style={{ marginBottom: '10px' }}
        >
          {writeupExpanded ? 'Show less' : 'Read more'}
        </button>
      )}

      <div className="overheard-quotes">
        {visibleQuotes.map((q, i) => (
          <div key={`${q.candidateId ?? i}-${q.approxTimestampSec}`} className="overheard-quote">
            <div className="overheard-quote__speaker">{q.speaker}</div>
            <p className="overheard-quote__text">&ldquo;{q.text}&rdquo;</p>
          </div>
        ))}
      </div>

      {quotes.length > 2 && (
        <button
          type="button"
          className="spotted-tweet-preview__link"
          onClick={() => setQuotesExpanded(v => !v)}
          style={{ marginTop: '4px', marginBottom: '8px' }}
        >
          {quotesExpanded ? 'Show fewer quotes' : `Read more (${hiddenQuoteCount} more)`}
        </button>
      )}

      <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {digest?.alsoDiscussed ?? `${entry.episodeName} · published in the last 24 hours`}
      </p>
    </div>
  )
}
