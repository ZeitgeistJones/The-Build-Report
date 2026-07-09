'use client'

import { useEffect } from 'react'
import type { SpottedEntry } from '@/lib/spotted'

interface Props {
  spotted: SpottedEntry | null
}

export default function SpottedCard({ spotted }: Props) {
  useEffect(() => {
    if (!spotted) return
    if (document.getElementById('twitter-wjs')) return
    const script = document.createElement('script')
    script.id = 'twitter-wjs'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    document.body.appendChild(script)
  }, [spotted])

  if (!spotted) return null

  return (
    <div
      style={{
        marginBottom: '20px',
        padding: '14px 16px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
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

      <p style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        {spotted.writeup}
      </p>

      <div dangerouslySetInnerHTML={{ __html: spotted.embedHtml }} />
    </div>
  )
}
