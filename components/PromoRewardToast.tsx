'use client'

import { useEffect, useState } from 'react'
import { isPromoRewardSoundEnabled, setPromoRewardSoundEnabled } from '@/lib/promoRewardFx'

interface Props {
  amountLabel: string
  pending?: boolean
  txUrl?: string | null
}

export default function PromoRewardToast({ amountLabel, pending, txUrl }: Props) {
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => {
    setSoundOn(isPromoRewardSoundEnabled())
  }, [])

  return (
    <div className="promo-reward-toast" role="status" aria-live="polite">
      <div className="promo-reward-toast__chip">
        <span className="promo-reward-toast__check" aria-hidden>
          ✓
        </span>
        <span className="promo-reward-toast__amount">+{amountLabel}</span>
        <span className="promo-reward-toast__label">earned</span>
      </div>
      <div className="promo-reward-toast__meta">
        {pending ? (
          <span>Rescore saved — confirming on Base.</span>
        ) : (
          <span>Rescore saved — sent to your wallet.</span>
        )}
        {txUrl && (
          <>
            {' '}
            <a href={txUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
              View tx ↗
            </a>
          </>
        )}
        {' '}
        <button
          type="button"
          className="promo-reward-toast__mute"
          onClick={e => {
            e.stopPropagation()
            const next = !isPromoRewardSoundEnabled()
            setPromoRewardSoundEnabled(next)
            setSoundOn(next)
          }}
        >
          {soundOn ? 'Sound on' : 'Sound off'}
        </button>
      </div>
    </div>
  )
}
