'use client'

import type { ArchiveFeedItem } from '@/lib/archives'
import BuildBriefCard from '@/components/BuildBriefCard'

export default function ArchivesFeed({ items }: { items: ArchiveFeedItem[] }) {
  if (!items.length) {
    return (
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Nothing in this window yet. Build Briefs keep about 90 days of editions.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map(item => (
        <div key={`brief-${item.dateKey}`}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '6px',
              paddingLeft: '2px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Yesterday&apos;s build
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.dateKey}</span>
          </div>

          <BuildBriefCard brief={item.brief} />
        </div>
      ))}
    </div>
  )
}
