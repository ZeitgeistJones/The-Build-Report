'use client'

import {
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

export default function PromoSoundPreviewPage() {
  function handlePlay(variant: PromoRewardSoundVariant) {
    primePromoRewardAudio({ preview: true })
    playPromoRewardVariant(variant, { preview: true })
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
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '460px', textAlign: 'center', lineHeight: 1.5 }}>
        More soft-earn + cash-drawer combos below. Cheap to iterate — just say which one to ship live.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: 'min(460px, 100%)' }}>
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
                    onClick={() => handlePlay(variant.id)}
                    style={variant.live ? liveButtonStyle : variant.pick ? pickButtonStyle : buttonStyle}
                  >
                    <div>
                      {variant.label}
                      {variant.live ? ' · live now' : ''}
                      {variant.pick && !variant.live ? ' · your pick' : ''}
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
