'use client'

import { useEffect, useRef, useState } from 'react'
import {
  PROMO_REWARD_PREVIEW_WAIT_MS,
  PROMO_REWARD_SOUND_GROUPS,
  PROMO_REWARD_SOUND_VARIANTS,
  playPromoRewardVariant,
  primePromoRewardAudio,
  type PromoRewardSoundVariant,
} from '@/lib/promoRewardFx'

const buttonStyle = {
  fontSize: '13px',
  padding: '10px 14px',
  borderRadius: '99px',
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text-secondary)',
  fontWeight: 500,
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left' as const,
}

const liveButtonStyle = {
  ...buttonStyle,
  border: '1px solid var(--accent-border)',
  background: 'var(--accent-dim)',
  color: 'var(--accent)',
  fontWeight: 600,
}

const pickButtonStyle = {
  ...buttonStyle,
  border: '1px solid color-mix(in srgb, var(--green) 40%, transparent)',
  background: 'color-mix(in srgb, var(--green) 10%, var(--surface-2))',
}

const finalistButtonStyle = {
  ...pickButtonStyle,
  border: '1px solid color-mix(in srgb, var(--green) 65%, transparent)',
  background: 'color-mix(in srgb, var(--green) 16%, var(--surface-2))',
  fontWeight: 600,
}

export default function PromoSoundPreviewPage() {
  const [simulateWait, setSimulateWait] = useState(true)
  const [waitSecondsLeft, setWaitSecondsLeft] = useState<number | null>(null)
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)
  const playTimeoutRef = useRef<number | null>(null)
  const tickIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) window.clearTimeout(playTimeoutRef.current)
      if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current)
    }
  }, [])

  function clearPendingTimers() {
    if (playTimeoutRef.current) {
      window.clearTimeout(playTimeoutRef.current)
      playTimeoutRef.current = null
    }
    if (tickIntervalRef.current) {
      window.clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
    }
    setWaitSecondsLeft(null)
    setPendingLabel(null)
  }

  function handlePlay(variant: PromoRewardSoundVariant, label: string) {
    clearPendingTimers()
    primePromoRewardAudio({ preview: true })

    if (!simulateWait) {
      playPromoRewardVariant(variant, { preview: true })
      return
    }

    const waitSec = PROMO_REWARD_PREVIEW_WAIT_MS / 1000
    setPendingLabel(label)
    setWaitSecondsLeft(waitSec)

    tickIntervalRef.current = window.setInterval(() => {
      setWaitSecondsLeft(prev => {
        if (prev === null || prev <= 1) return null
        return prev - 1
      })
    }, 1000)

    playTimeoutRef.current = window.setTimeout(() => {
      if (tickIntervalRef.current) window.clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
      playTimeoutRef.current = null
      setWaitSecondsLeft(null)
      setPendingLabel(null)
      playPromoRewardVariant(variant, { preview: true })
    }, PROMO_REWARD_PREVIEW_WAIT_MS)
  }

  const busy = waitSecondsLeft !== null

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
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '480px', textAlign: 'center', lineHeight: 1.5 }}>
        Touchdown + sweet land at the top. Keep 5s wait on.
      </p>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={simulateWait}
          onChange={e => {
            if (!e.target.checked) clearPendingTimers()
            setSimulateWait(e.target.checked)
          }}
        />
        Simulate 5s scoring wait (recommended)
      </label>

      {busy && (
        <div
          style={{
            fontSize: '13px',
            color: 'var(--accent)',
            fontWeight: 600,
            padding: '8px 12px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--accent-border)',
            background: 'var(--accent-dim)',
          }}
        >
          Scoring… {waitSecondsLeft}s — then “{pendingLabel}”
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: 'min(480px, 100%)' }}>
        {PROMO_REWARD_SOUND_GROUPS.map(group => {
          const variants = PROMO_REWARD_SOUND_VARIANTS.filter(v => v.group === group.id)
          if (!variants.length) return null

          return (
            <section key={group.id}>
              <h2 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {group.label}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {variants.map(variant => (
                  <button
                    key={variant.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handlePlay(variant.id, variant.label)}
                    style={
                      variant.live
                        ? { ...liveButtonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }
                        : variant.finalist
                          ? { ...finalistButtonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }
                          : variant.pick
                            ? { ...pickButtonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }
                            : { ...buttonStyle, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }
                    }
                  >
                    <div>
                      {variant.label}
                      {variant.live ? ' · live now' : ''}
                      {variant.finalist ? ' · finalist' : variant.pick && !variant.live ? ' · your pick' : ''}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.35 }}>
                      {variant.hint}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <a href="/" style={{ fontSize: '13px', marginTop: '8px' }}>
        ← Back home
      </a>
    </main>
  )
}
