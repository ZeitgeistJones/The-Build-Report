'use client'

import { useState } from 'react'
import type { BuildBriefData } from '@/lib/buildBrief'
import { useNormieMode } from '@/components/NormieModeProvider'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  brief: BuildBriefData | null
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format YYYY-MM-DD as a calendar label — no Date/TZ (UTC browsers were showing the previous day). */
function formatDigestDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d || m < 1 || m > 12) return dateKey
  return `${SHORT_MONTHS[m - 1]} ${d}`
}

/** Split a wall of text into 2–3 short paragraphs for scanning. */
function splitBriefParagraphs(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (trimmed.includes('\n\n')) {
    return trimmed.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
  }

  const sentences =
    trimmed.match(/[^.!?]+[.!?]+(?:\s|$)/g)?.map(s => s.trim()).filter(Boolean) ?? [trimmed]
  if (sentences.length <= 2) return [trimmed]

  const chunkSize = sentences.length <= 4 ? 2 : Math.ceil(sentences.length / 3)
  const paragraphs: string[] = []
  for (let i = 0; i < sentences.length; i += chunkSize) {
    paragraphs.push(sentences.slice(i, i + chunkSize).join(' '))
  }
  return paragraphs
}

const MOBILE_COLLAPSE_CHARS = 220

export default function BuildBriefCard({ brief }: Props) {
  const { normie } = useNormieMode()
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)

  if (!brief) return null
  const text = (normie && brief.generalNormie) || brief.general || brief.text
  if (!text) return null

  const dayLabel = brief.dateKey ? formatDigestDate(brief.dateKey) : 'yesterday'
  const paragraphs = isMobile ? splitBriefParagraphs(text) : [text]
  const collapsible = isMobile && text.length > MOBILE_COLLAPSE_CHARS
  const collapsed = collapsible && !expanded

  return (
    <div
      className="build-brief-card"
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
          Yesterday&apos;s build
        </span>
        <span className="build-brief-meta" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {dayLabel}
          {brief.repoCount > 0 && (
            <>
              {' '}
              · {brief.repoCount} repo{brief.repoCount === 1 ? '' : 's'}
              {brief.commitCount > 0 && ` · ${brief.commitCount} commits`}
            </>
          )}
        </span>
      </div>

      <div className={collapsed ? 'build-brief-body build-brief-body--collapsed' : 'build-brief-body'}>
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            style={{
              margin: index === 0 ? 0 : '12px 0 0',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
            }}
          >
            {paragraph}
          </p>
        ))}
      </div>

      {collapsible && (
        <button
          type="button"
          className="build-brief-toggle"
          onClick={() => setExpanded(open => !open)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Plain-English summary · refreshes daily overnight Eastern
      </p>
    </div>
  )
}
