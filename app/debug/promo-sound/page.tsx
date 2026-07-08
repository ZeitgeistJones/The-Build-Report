'use client'

import { playPromoRewardChime, primePromoRewardAudio } from '@/lib/promoRewardFx'

export default function PromoSoundPreviewPage() {
  function handlePlay() {
    primePromoRewardAudio()
    playPromoRewardChime()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '24px',
      }}
    >
      <h1 style={{ fontSize: '20px', fontWeight: 600 }}>Promo reward sound preview</h1>
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '360px', textAlign: 'center', lineHeight: 1.5 }}>
        Same cha-ching used after a promo payout. Click once — browsers need a click before audio plays.
      </p>
      <button
        type="button"
        onClick={handlePlay}
        style={{
          fontSize: '14px',
          padding: '10px 18px',
          borderRadius: '99px',
          border: '1px solid var(--accent-border)',
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Play cha-ching
      </button>
      <a href="/" style={{ fontSize: '13px', marginTop: '8px' }}>
        ← Back home
      </a>
    </main>
  )
}
