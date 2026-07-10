'use client'

import { useState } from 'react'
import type { OverheardEntry, OverheardQuote } from '@/lib/podcastMentions'
import type { OverheardDigest } from '@/lib/overheard'
import { useNormieMode } from '@/components/NormieModeProvider'

interface Props {
  entry: OverheardEntry | null
  digest: OverheardDigest | null
}

/** Drop quotes where both speaker and text are whitespace-only. */
export function isEmptyQuote(q: { speaker?: string; text?: string }): boolean {
  return !q.speaker?.trim() && !q.text?.trim()
}

export function filterValidQuotes<T extends OverheardQuote>(quotes: T[]): T[] {
  return quotes.filter(q => !isEmptyQuote(q))
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

function buildEpisodeMeta(entry: OverheardEntry, validQuoteCount: number): string {
  const parts: string[] = []
  if (entry.episodeSlug) parts.push(entry.episodeSlug)

  const validQuotes = filterValidQuotes(entry.quotes)
  const guest = displayGuest(validQuotes[0]?.speaker)
  if (guest) parts.push(`guest: ${guest}`)
  else if (entry.episodeName) parts.push(entry.episodeName)

  if (entry.kind === 'thread' && validQuoteCount > 1) {
    parts.push(`${validQuoteCount} quotes`)
  }

  parts.push('Slop.Computer')
  return parts.join(' · ')
}

export default function OverheardCard({ entry, digest }: Props) {
  const { normie } = useNormieMode()
  const [writeupExpanded, setWriteupExpanded] = useState(false)
  const [quotesExpanded, setQuotesExpanded] = useState(false)

  if (!entry) return null

  const writeup = (normie && entry.writeupNormie) || entry.writeup
  const writeupLong = writeup.length > 180 || writeup.split(/\s+/).length > 40
  const validQuotes = filterValidQuotes(entry.quotes)
  const visibleQuotes = quotesExpanded ? validQuotes : validQuotes.slice(0, 2)
  const hiddenQuoteCount = validQuotes.length - visibleQuotes.length

  return (
    <div
      className="overheard-card"
      style={{
        padding: '14px 16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
        alignSelf: 'start',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '8px',
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
        <p className="overheard-card__meta">{buildEpisodeMeta(entry, validQuotes.length)}</p>
        {entry.episodeUrl && (
          <a
            href={entry.episodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="overheard-card__episode-link"
          >
            Episode link ↗
          </a>
        )}
      </header>

      <p className={`spotted-writeup${writeupExpanded || !writeupLong ? '' : ' spotted-writeup--clamped'}`}>
        {writeup}
      </p>
      {writeupLong && (
        <button
          type="button"
          className="spotted-tweet-preview__link"
          onClick={() => setWriteupExpanded(v => !v)}
          style={{ marginBottom: '8px' }}
        >
          {writeupExpanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {validQuotes.length > 0 && (
        <div className="overheard-quotes">
          {visibleQuotes.map((q, i) => (
            <div key={`${q.candidateId ?? i}-${q.approxTimestampSec}`} className="overheard-quote">
              <div className="overheard-quote__speaker">{q.speaker}</div>
              <p className="overheard-quote__text">&ldquo;{q.text}&rdquo;</p>
            </div>
          ))}
        </div>
      )}

      {validQuotes.length > 2 && (
        <button
          type="button"
          className="spotted-tweet-preview__link"
          onClick={() => setQuotesExpanded(v => !v)}
          style={{ marginTop: '2px', marginBottom: '4px' }}
        >
          {quotesExpanded ? 'Show fewer quotes' : `Read more (${hiddenQuoteCount} more)`}
        </button>
      )}

      <p className="overheard-card__footer">
        {digest?.alsoDiscussed ?? `${entry.episodeName} · published in the last 24 hours`}
      </p>
    </div>
  )
}
