'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RESCORE_PROMO_SITE_BANNER } from '@/lib/scoringCopy'
import { formatEthAmount } from '@/lib/clawdBurnIndex'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'

const STORAGE_KEY = 'tbr-rescore-promo-banner'

type BannerMode = 'expanded' | 'minimized'

function loadMode(): BannerMode {
  if (typeof window === 'undefined') return 'expanded'
  try {
    return localStorage.getItem(STORAGE_KEY) === 'minimized' ? 'minimized' : 'expanded'
  } catch {
    return 'expanded'
  }
}

function saveMode(mode: BannerMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore quota errors
  }
}

function formatEndsAt(endsAt: string | null): string | null {
  if (!endsAt) return null
  const end = new Date(endsAt)
  if (Number.isNaN(end.getTime())) return null
  return end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

export default function RescorePromoBanner({
  endsAt,
  pennyEth,
}: {
  endsAt: string | null
  pennyEth: number
}) {
  const isMobile = useIsMobile()
  const [mode, setMode] = useState<BannerMode | null>(null)
  const endsLabel = formatEndsAt(endsAt)
  const rewardLabel = formatEthAmount(pennyEth)

  useEffect(() => {
    setMode(loadMode())
  }, [])

  if (!mode) return null

  if (mode === 'minimized') {
    return (
      <div className="rescore-promo-banner rescore-promo-banner--minimized">
        <p className="rescore-promo-banner__minimized-text">{RESCORE_PROMO_SITE_BANNER.minimizedHint}</p>
        <button
          type="button"
          className="rescore-promo-banner__action"
          onClick={() => {
            setMode('expanded')
            saveMode('expanded')
          }}
          style={{ minHeight: isMobile ? MIN_TAP : undefined }}
        >
          {RESCORE_PROMO_SITE_BANNER.expandLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="rescore-promo-banner" role="region" aria-label="Rescore launch promo">
      <div className="rescore-promo-banner__header">
        <div>
          <p className="rescore-promo-banner__eyebrow">Limited time</p>
          <h2 className="rescore-promo-banner__title">{RESCORE_PROMO_SITE_BANNER.title}</h2>
        </div>
        <button
          type="button"
          className="rescore-promo-banner__action"
          onClick={() => {
            setMode('minimized')
            saveMode('minimized')
          }}
          aria-label="Minimize promo banner"
          style={{ minHeight: isMobile ? MIN_TAP : undefined }}
        >
          {RESCORE_PROMO_SITE_BANNER.minimizeLabel}
        </button>
      </div>

      <p className="rescore-promo-banner__summary">{RESCORE_PROMO_SITE_BANNER.summary}</p>

      <ul className="rescore-promo-banner__list">
        {RESCORE_PROMO_SITE_BANNER.bullets.map(item => (
          <li key={item}>{item.replace('~1¢', `~${rewardLabel}`)}</li>
        ))}
      </ul>

      {endsLabel && (
        <p className="rescore-promo-banner__meta">Scheduled end (Eastern): {endsLabel} — may end earlier if treasury runs low.</p>
      )}

      <p className="rescore-promo-banner__disclaimer">{RESCORE_PROMO_SITE_BANNER.disclaimer}</p>

      <p className="rescore-promo-banner__link">
        <Link href="/about#score-types">About score types &amp; promo ↗</Link>
      </p>
    </div>
  )
}
