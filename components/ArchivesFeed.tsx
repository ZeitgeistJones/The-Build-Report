'use client'

import type { ArchiveFeedItem } from '@/lib/archives'
import BuildBriefCard from '@/components/BuildBriefCard'
import NeedleCard from '@/components/NeedleCard'
import SpottedCard from '@/components/SpottedCard'
import OverheardCard from '@/components/OverheardCard'

function kindLabel(kind: ArchiveFeedItem['kind']): string {
  if (kind === 'brief') return 'Yesterday\'s build'
  if (kind === 'needle') return 'The Needle'
  if (kind === 'spotted') return 'Spotted'
  return 'Overheard'
}

function dateLabel(item: ArchiveFeedItem): string {
  if (item.kind === 'brief' || item.kind === 'needle') return item.dateKey
  const iso =
    item.kind === 'spotted'
      ? item.spotted.publishedAt
      : item.entry.publishedAt
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ArchivesFeed({ items }: { items: ArchiveFeedItem[] }) {
  if (!items.length) {
    return (
      <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Nothing in this window yet. Briefs and Needles start archiving from deploy — Spotted and
        Overheard go back farther when published.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map(item => {
        const key =
          item.kind === 'brief'
            ? `brief-${item.dateKey}`
            : item.kind === 'needle'
              ? `needle-${item.dateKey}`
              : item.kind === 'spotted'
                ? `spotted-${item.spotted.id}`
                : `overheard-${item.entry.id}`

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
            {item.kind === 'spotted' && <SpottedCard spotted={item.spotted} />}
            {item.kind === 'overheard' && <OverheardCard entry={item.entry} digest={null} />}
          </div>
        )
      })}
    </div>
  )
}
