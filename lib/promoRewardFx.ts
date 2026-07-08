const SOUND_PREF_KEY = 'promo-reward-sound'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isPromoRewardSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SOUND_PREF_KEY) !== 'off'
}

export function setPromoRewardSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SOUND_PREF_KEY, enabled ? 'on' : 'off')
}

/** Short coin-like chime — no audio file, respects reduced motion + mute pref. */
export function playPromoRewardChime() {
  if (typeof window === 'undefined') return
  if (prefersReducedMotion() || !isPromoRewardSoundEnabled()) return

  const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  const ctx = new AudioCtx()
  const now = ctx.currentTime
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.32, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
  gain.connect(ctx.destination)

  const tone = (freq: number, start: number, duration: number) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, start)
    osc.connect(gain)
    osc.start(start)
    osc.stop(start + duration)
  }

  tone(880, now, 0.09)
  tone(1318.5, now + 0.07, 0.16)

  window.setTimeout(() => {
    void ctx.close()
  }, 400)
}
