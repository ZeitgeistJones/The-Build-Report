const SOUND_PREF_KEY = 'promo-reward-sound'

let primedAudioContext: AudioContext | null = null

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

/** Call on button click so the later chime isn't blocked after async scoring. */
export function primePromoRewardAudio() {
  if (typeof window === 'undefined') return
  if (prefersReducedMotion() || !isPromoRewardSoundEnabled()) return

  const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  if (!primedAudioContext || primedAudioContext.state === 'closed') {
    primedAudioContext = new AudioCtx()
  }
  if (primedAudioContext.state === 'suspended') {
    void primedAudioContext.resume()
  }
}

/** Short cha-ching — register thunk + coin bell, not arcade zap. */
export function playPromoRewardChime() {
  if (typeof window === 'undefined') return
  if (prefersReducedMotion() || !isPromoRewardSoundEnabled()) return

  const ctx = primedAudioContext
  if (!ctx || ctx.state === 'closed') return

  const now = ctx.currentTime
  const out = ctx.destination

  const env = (start: number, peak: number, decay: number) => {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), start + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, start + decay)
    g.connect(out)
    return g
  }

  // "cha" — quick drawer thunk
  const chaStart = now
  const chaGain = env(chaStart, 0.2, 0.08)
  const cha = ctx.createOscillator()
  cha.type = 'triangle'
  cha.frequency.setValueAtTime(420, chaStart)
  cha.frequency.exponentialRampToValueAtTime(260, chaStart + 0.06)
  cha.connect(chaGain)
  cha.start(chaStart)
  cha.stop(chaStart + 0.08)

  const noiseLength = Math.floor(ctx.sampleRate * 0.04)
  const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseLength; i++) {
    noiseData[i] = Math.random() * 2 - 1
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = 900
  noiseFilter.Q.value = 0.7
  const noiseGain = env(chaStart, 0.05, 0.05)
  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noise.start(chaStart)
  noise.stop(chaStart + 0.05)

  // "ching" — bright coin hit
  const chingStart = now + 0.06
  const chingGain = env(chingStart, 0.26, 0.32)
  for (const [freq, level] of [
    [1960, 1],
    [3920, 0.28],
    [5880, 0.12],
  ] as const) {
    const partial = ctx.createGain()
    partial.gain.value = level
    partial.connect(chingGain)
    const bell = ctx.createOscillator()
    bell.type = 'sine'
    bell.frequency.setValueAtTime(freq, chingStart)
    bell.connect(partial)
    bell.start(chingStart)
    bell.stop(chingStart + 0.32)
  }

  // trailing coin ping
  const pingStart = now + 0.14
  const pingGain = env(pingStart, 0.1, 0.14)
  const ping = ctx.createOscillator()
  ping.type = 'sine'
  ping.frequency.setValueAtTime(2489, pingStart)
  ping.connect(pingGain)
  ping.start(pingStart)
  ping.stop(pingStart + 0.14)
}
