'use client'

import { useEffect, useState } from 'react'
import type { SpottedEntry } from '@/lib/spotted'

interface Props {
  spotted: SpottedEntry | null
}

function handleFromTweetUrl(tweetUrl: string): string | null {
  try {
    const path = new URL(tweetUrl).pathname
    const segment = path.split('/').filter(Boolean)[0]
    return segment ? `@${segment}` : null
  } catch {
    return null
  }
}

export default function SpottedCard({ spotted }: Props) {
  const [writeupExpanded, setWriteupExpanded] = useState(false)
  const [tweetExpanded, setTweetExpanded] = useState(true)

  useEffect(() => {
    if (!spotted || !tweetExpanded) return
    const existing = document.getElementById('twitter-wjs') as HTMLScriptElement | null
    if (existing) {
      // Re-process embeds after expand
      const twttr = (window as unknown as { twttr?: { widgets?: { load?: () => void } } }).twttr
      twttr?.widgets?.load?.()
      return
    }
    const script = document.createElement('script')
    script.id = 'twitter-wjs'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    document.body.appendChild(script)
  }, [spotted, tweetExpanded])

  if (!spotted) return null

  const handle = handleFromTweetUrl(spotted.tweetUrl)
  const initial = (spotted.authorName.trim()[0] || '?').toUpperCase()
  const writeupLong = spotted.writeup.length > 180 || spotted.writeup.split(/\s+/).length > 40

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
          Spotted
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {spotted.authorName} on X
        </span>
      </div>

      <p className={`spotted-writeup${writeupExpanded || !writeupLong ? '' : ' spotted-writeup--clamped'}`}>
        {spotted.writeup}
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

      {tweetExpanded ? (
        <div>
          <div dangerouslySetInnerHTML={{ __html: spotted.embedHtml }} />
          <div className="spotted-tweet-preview__actions" style={{ marginTop: '8px' }}>
            <button
              type="button"
              className="spotted-tweet-preview__link"
              onClick={() => setTweetExpanded(false)}
            >
              Collapse tweet
            </button>
            <a
              href={spotted.tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="spotted-tweet-preview__link"
            >
              Open on X
            </a>
          </div>
        </div>
      ) : (
        <div className="spotted-tweet-preview">
          <div className="spotted-tweet-preview__author">
            <span className="spotted-tweet-preview__avatar" aria-hidden>
              {initial}
            </span>
            <div className="spotted-tweet-preview__meta">
              <span className="spotted-tweet-preview__name">{spotted.authorName}</span>
              {handle && <span className="spotted-tweet-preview__handle">{handle}</span>}
            </div>
          </div>
          <p className="spotted-tweet-preview__text">{spotted.tweetText}</p>
          <div className="spotted-tweet-preview__actions">
            <button
              type="button"
              className="spotted-tweet-preview__link"
              onClick={() => setTweetExpanded(true)}
            >
              View tweet
            </button>
            <a
              href={spotted.tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="spotted-tweet-preview__link"
            >
              Open on X
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
