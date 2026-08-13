'use client'

import type { ArchiveFeedItem } from '@/lib/archives'
import BuildBriefCard from '@/components/BuildBriefCard'
import NeedleCard from '@/components/NeedleCard'

function kindLabel(kind: ArchiveFeedItem['kind']): string {
  if (kind === 'brief') return "Yesterday's build"
  return 'The Needle'
}

function dateLabel(item: ArchiveFeedItem): string {
  return item.dateKey
}

export default function ArchivesFeed({ items }: { items: ArchiveFeedItem[] }) {
  if (!items.length) {
    return (
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Nothing in this window yet. Briefs and Needles keep about 90 days of editions.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map(item => {
        const key = item.kind === 'brief' ? `brief-${item.dateKey}` : `needle-${item.dateKey}`

        return (
          <div key={key}>
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
                {kindLabel(item.kind)}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dateLabel(item)}</span>
            </div>

            {item.kind === 'brief' && <BuildBriefCard brief={item.brief} />}
            {item.kind === 'needle' && <NeedleCard needle={item.needle} />}
          </div>
        )
      })}
    </div>
  )
}
