const SOUND_PREF_KEY = 'promo-reward-sound'

export type PromoRewardSoundVariant = 'cha-ching' | 'coin-stack' | 'cash-drawer' | 'soft-earn'

export const PROMO_REWARD_SOUND_VARIANTS: {
  id: PromoRewardSoundVariant
  label: string
  hint: string
  live?: boolean
}[] = [
  {
    id: 'cha-ching',
    label: 'Cha-ching',
    hint: 'Quick drawer thunk + bright coin bell. Current live sound.',
    live: true,
  },
  {
    id: 'coin-stack',
    label: 'Coin stack',
    hint: 'Three rapid coin pings — coins dropping into a tray.',
  },
  {
    id: 'cash-drawer',
    label: 'Cash drawer',
    hint: 'Heavier register open, then a longer metallic ring.',
  },
  {
    id: 'soft-earn',
    label: 'Soft earn',
    hint: 'Warm, lower payout ping — notification more than arcade.',
  },
]

const DEFAULT_VARIANT: PromoRewardSoundVariant = 'cha-ching'

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
export function primePromoRewardAudio(options?: { preview?: boolean }) {
  if (typeof window === 'undefined') return
  if (!options?.preview && (prefersReducedMotion() || !isPromoRewardSoundEnabled())) return

  const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return

  if (!primedAudioContext || primedAudioContext.state === 'closed') {
    primedAudioContext = new AudioCtx()
  }
  if (primedAudioContext.state === 'suspended') {
    void primedAudioContext.resume()
  }
}

type Synth = {
  ctx: AudioContext
  now: number
  env: (start: number, peak: number, decay: number) => GainNode
}

function getSynth(ctx: AudioContext): Synth {
  const now = ctx.currentTime
  const out = ctx.destination

  return {
    ctx,
    now,
    env: (start: number, peak: number, decay: number) => {
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), start + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, start + decay)
      g.connect(out)
      return g
    },
  }
}

function playTone(
  synth: Synth,
  start: number,
  freq: number,
  peak: number,
  decay: number,
  type: OscillatorType = 'sine',
  slideTo?: number,
) {
  const gain = synth.env(start, peak, decay)
  const osc = synth.ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, start + decay * 0.75)
  }
  osc.connect(gain)
  osc.start(start)
  osc.stop(start + decay)
}

function playBell(
  synth: Synth,
  start: number,
  partials: readonly [number, number][],
  peak: number,
  decay: number,
) {
  const gain = synth.env(start, peak, decay)
  for (const [freq, level] of partials) {
    const partial = synth.ctx.createGain()
    partial.gain.value = level
    partial.connect(gain)
    const bell = synth.ctx.createOscillator()
    bell.type = 'sine'
    bell.frequency.setValueAtTime(freq, start)
    bell.connect(partial)
    bell.start(start)
    bell.stop(start + decay)
  }
}

function playDrawerNoise(synth: Synth, start: number, peak: number, decay: number, centerHz: number) {
  const noiseLength = Math.floor(synth.ctx.sampleRate * decay)
  const noiseBuffer = synth.ctx.createBuffer(1, noiseLength, synth.ctx.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseLength; i++) {
    noiseData[i] = Math.random() * 2 - 1
  }
  const noise = synth.ctx.createBufferSource()
  noise.buffer = noiseBuffer
  const noiseFilter = synth.ctx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = centerHz
  noiseFilter.Q.value = 0.7
  const noiseGain = synth.env(start, peak, decay)
  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noise.start(start)
  noise.stop(start + decay)
}

function playChaChing(synth: Synth) {
  const { now } = synth
  playTone(synth, now, 420, 0.2, 0.08, 'triangle', 260)
  playDrawerNoise(synth, now, 0.05, 0.05, 900)
  playBell(
    synth,
    now + 0.06,
    [
      [1960, 1],
      [3920, 0.28],
      [5880, 0.12],
    ],
    0.26,
    0.32,
  )
  playTone(synth, now + 0.14, 2489, 0.1, 0.14)
}

function playCoinStack(synth: Synth) {
  const { now } = synth
  const pings: [number, number, number][] = [
    [0, 2217, 0.22],
    [0.055, 2637, 0.18],
    [0.1, 3136, 0.16],
    [0.14, 2793, 0.12],
  ]
  for (const [offset, freq, peak] of pings) {
    playBell(
      synth,
      now + offset,
      [
        [freq, 1],
        [freq * 2, 0.22],
      ],
      peak,
      0.12,
    )
  }
}

function playCashDrawer(synth: Synth) {
  const { now } = synth
  playTone(synth, now, 320, 0.24, 0.12, 'triangle', 180)
  playDrawerNoise(synth, now, 0.08, 0.09, 650)
  playDrawerNoise(synth, now + 0.03, 0.04, 0.06, 1400)
  playBell(
    synth,
    now + 0.1,
    [
      [1760, 1],
      [3520, 0.35],
      [5280, 0.15],
    ],
    0.28,
    0.42,
  )
}

function playSoftEarn(synth: Synth) {
  const { now } = synth
  playTone(synth, now + 0.02, 740, 0.14, 0.1, 'sine', 620)
  playBell(
    synth,
    now + 0.09,
    [
      [1318, 1],
      [2636, 0.18],
    ],
    0.2,
    0.28,
  )
  playTone(synth, now + 0.2, 1568, 0.08, 0.18)
}

const VARIANT_PLAYERS: Record<PromoRewardSoundVariant, (synth: Synth) => void> = {
  'cha-ching': playChaChing,
  'coin-stack': playCoinStack,
  'cash-drawer': playCashDrawer,
  'soft-earn': playSoftEarn,
}

export function playPromoRewardVariant(
  variant: PromoRewardSoundVariant = DEFAULT_VARIANT,
  options?: { preview?: boolean },
) {
  if (typeof window === 'undefined') return
  if (!options?.preview && (prefersReducedMotion() || !isPromoRewardSoundEnabled())) return

  const ctx = primedAudioContext
  if (!ctx || ctx.state === 'closed') return

  VARIANT_PLAYERS[variant](getSynth(ctx))
}

/** Live promo payout sound. */
export function playPromoRewardChime() {
  playPromoRewardVariant(DEFAULT_VARIANT)
}
