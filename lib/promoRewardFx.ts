const SOUND_PREF_KEY = 'promo-reward-sound'

export type PromoRewardSoundGroup = 'glow' | 'soft' | 'combo' | 'drawer' | 'classic'

export type PromoRewardSoundVariant =
  | 'cha-ching'
  | 'coin-stack'
  | 'cash-drawer'
  | 'soft-earn'
  | 'soft-drawer'
  | 'drawer-earn'
  | 'warm-register'
  | 'gentle-payout'
  | 'soft-cash-combo'
  | 'register-glow'
  | 'glow-trio'
  | 'glow-earn'
  | 'glow-payout'
  | 'whisper-glow'
  | 'soft-glow'
  | 'gentle-glow'
  | 'earn-whisper'
  | 'payout-glow'
  | 'register-hush'

export const PROMO_REWARD_SOUND_GROUPS: { id: PromoRewardSoundGroup; label: string }[] = [
  { id: 'glow', label: 'Glow family (your direction)' },
  { id: 'soft', label: 'Soft earn & gentle payout' },
  { id: 'combo', label: 'Combos (soft + drawer)' },
  { id: 'drawer', label: 'Cash drawer family' },
  { id: 'classic', label: 'Earlier options' },
]

export const PROMO_REWARD_SOUND_VARIANTS: {
  id: PromoRewardSoundVariant
  label: string
  hint: string
  group: PromoRewardSoundGroup
  live?: boolean
  pick?: boolean
}[] = [
  {
    id: 'glow-trio',
    label: 'Glow trio',
    hint: 'All three favorites — register rustle, gentle pings, soft earn finish.',
    group: 'glow',
    pick: true,
  },
  {
    id: 'register-glow',
    label: 'Register glow',
    hint: 'Drawer rustle under a soft glowing payout tone.',
    group: 'glow',
    pick: true,
  },
  {
    id: 'glow-earn',
    label: 'Glow earn',
    hint: 'Register glow opening with a clearer soft-earn bell.',
    group: 'glow',
    pick: true,
  },
  {
    id: 'glow-payout',
    label: 'Glow payout',
    hint: 'Register rustle into gentle-payout pings — no sharp bell.',
    group: 'glow',
    pick: true,
  },
  {
    id: 'whisper-glow',
    label: 'Whisper glow',
    hint: 'Register glow turned down — hushed money received.',
    group: 'glow',
  },
  {
    id: 'soft-glow',
    label: 'Soft glow',
    hint: 'Pure warm tones, no mechanical rustle.',
    group: 'glow',
  },
  {
    id: 'gentle-glow',
    label: 'Gentle glow',
    hint: 'Gentle payout notes with a faint register shimmer underneath.',
    group: 'glow',
  },
  {
    id: 'register-hush',
    label: 'Register hush',
    hint: 'Tiny rustle + one warm tone — bare minimum glow.',
    group: 'glow',
  },
  {
    id: 'payout-glow',
    label: 'Payout glow',
    hint: 'Gentle payout lead-in, soft-earn bell lands at the end.',
    group: 'glow',
  },
  {
    id: 'soft-earn',
    label: 'Soft earn',
    hint: 'Warm, lower payout ping — notification more than arcade.',
    group: 'soft',
    pick: true,
  },
  {
    id: 'gentle-payout',
    label: 'Gentle payout',
    hint: 'Minimal double ping — quiet “funds received” feel.',
    group: 'soft',
    pick: true,
  },
  {
    id: 'earn-whisper',
    label: 'Earn whisper',
    hint: 'Soft earn at half volume — longer, softer decay.',
    group: 'soft',
  },
  {
    id: 'soft-cash-combo',
    label: 'Soft cash combo',
    hint: 'Light drawer + warm earn bell + tiny tail.',
    group: 'combo',
  },
  {
    id: 'soft-drawer',
    label: 'Soft drawer',
    hint: 'Gentle register thunk, then the soft-earn bell.',
    group: 'combo',
  },
  {
    id: 'drawer-earn',
    label: 'Drawer + earn',
    hint: 'Cash-drawer mechanics with soft-earn tones instead of a harsh ring.',
    group: 'combo',
  },
  {
    id: 'warm-register',
    label: 'Warm register',
    hint: 'Cash drawer shape, but lower and rounder — less metallic.',
    group: 'combo',
  },
  {
    id: 'cash-drawer',
    label: 'Cash drawer',
    hint: 'Heavier register open, then a longer metallic ring.',
    group: 'drawer',
  },
  {
    id: 'cha-ching',
    label: 'Cha-ching',
    hint: 'Quick drawer thunk + bright coin bell. Current live sound.',
    group: 'classic',
    live: true,
  },
  {
    id: 'coin-stack',
    label: 'Coin stack',
    hint: 'Three rapid coin pings — coins dropping into a tray.',
    group: 'classic',
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

function playSoftEarnBell(synth: Synth, start: number, peak = 0.2) {
  playBell(
    synth,
    start,
    [
      [1318, 1],
      [2636, 0.18],
    ],
    peak,
    0.28,
  )
}

function playLightDrawer(synth: Synth, start: number, peak = 0.14) {
  playTone(synth, start, 300, peak, 0.1, 'triangle', 210)
  playDrawerNoise(synth, start, peak * 0.28, 0.06, 720)
}

function playCashDrawerBody(synth: Synth, start: number, peak = 0.24) {
  playTone(synth, start, 320, peak, 0.12, 'triangle', 180)
  playDrawerNoise(synth, start, peak * 0.33, 0.09, 650)
  playDrawerNoise(synth, start + 0.03, peak * 0.17, 0.06, 1400)
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
  playCashDrawerBody(synth, now)
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
  playSoftEarnBell(synth, now + 0.09)
  playTone(synth, now + 0.2, 1568, 0.08, 0.18)
}

function playSoftDrawer(synth: Synth) {
  const { now } = synth
  playLightDrawer(synth, now)
  playTone(synth, now + 0.05, 700, 0.1, 0.08, 'sine', 580)
  playSoftEarnBell(synth, now + 0.1, 0.18)
  playTone(synth, now + 0.22, 1480, 0.06, 0.14)
}

function playDrawerEarn(synth: Synth) {
  const { now } = synth
  playCashDrawerBody(synth, now, 0.2)
  playTone(synth, now + 0.08, 700, 0.11, 0.09, 'sine', 590)
  playSoftEarnBell(synth, now + 0.12, 0.19)
  playTone(synth, now + 0.24, 1568, 0.07, 0.16)
}

function playWarmRegister(synth: Synth) {
  const { now } = synth
  playTone(synth, now, 280, 0.18, 0.11, 'triangle', 170)
  playDrawerNoise(synth, now, 0.05, 0.08, 580)
  playBell(
    synth,
    now + 0.09,
    [
      [1400, 1],
      [2800, 0.22],
    ],
    0.22,
    0.36,
  )
  playTone(synth, now + 0.2, 1244, 0.07, 0.16)
}

function playGentlePayout(synth: Synth) {
  const { now } = synth
  playTone(synth, now, 660, 0.11, 0.14, 'sine')
  playTone(synth, now + 0.1, 988, 0.13, 0.2, 'sine')
  playTone(synth, now + 0.2, 1174, 0.06, 0.16)
}

function playSoftCashCombo(synth: Synth) {
  const { now } = synth
  playLightDrawer(synth, now, 0.16)
  playTone(synth, now + 0.06, 680, 0.1, 0.08, 'sine', 560)
  playSoftEarnBell(synth, now + 0.1, 0.2)
  playTone(synth, now + 0.22, 1174, 0.08, 0.18)
}

function playRegisterGlowRustle(synth: Synth, start: number, scale = 1) {
  playDrawerNoise(synth, start, 0.045 * scale, 0.1, 520)
  playDrawerNoise(synth, start + 0.04, 0.025 * scale, 0.07, 1100)
}

function playRegisterGlow(synth: Synth) {
  const { now } = synth
  playRegisterGlowRustle(synth, now)
  playTone(synth, now + 0.07, 620, 0.12, 0.1, 'sine', 520)
  playSoftEarnBell(synth, now + 0.11, 0.17)
  playTone(synth, now + 0.26, 1318, 0.05, 0.2)
}

function playGlowTrio(synth: Synth) {
  const { now } = synth
  playRegisterGlowRustle(synth, now, 0.85)
  playTone(synth, now + 0.08, 620, 0.1, 0.1, 'sine', 540)
  playTone(synth, now + 0.14, 660, 0.1, 0.14, 'sine')
  playTone(synth, now + 0.22, 988, 0.11, 0.18, 'sine')
  playSoftEarnBell(synth, now + 0.28, 0.15)
  playTone(synth, now + 0.38, 1174, 0.05, 0.14)
}

function playGlowEarn(synth: Synth) {
  const { now } = synth
  playRegisterGlowRustle(synth, now)
  playTone(synth, now + 0.06, 700, 0.11, 0.09, 'sine', 590)
  playSoftEarnBell(synth, now + 0.1, 0.19)
  playTone(synth, now + 0.24, 1480, 0.07, 0.16)
}

function playGlowPayout(synth: Synth) {
  const { now } = synth
  playRegisterGlowRustle(synth, now, 0.9)
  playTone(synth, now + 0.1, 660, 0.1, 0.14, 'sine')
  playTone(synth, now + 0.2, 988, 0.12, 0.2, 'sine')
  playTone(synth, now + 0.3, 1174, 0.06, 0.16)
}

function playWhisperGlow(synth: Synth) {
  const { now } = synth
  playRegisterGlowRustle(synth, now, 0.55)
  playTone(synth, now + 0.08, 580, 0.08, 0.12, 'sine', 500)
  playSoftEarnBell(synth, now + 0.12, 0.11)
  playTone(synth, now + 0.28, 1244, 0.035, 0.22)
}

function playSoftGlow(synth: Synth) {
  const { now } = synth
  playTone(synth, now + 0.02, 580, 0.11, 0.12, 'sine', 500)
  playBell(
    synth,
    now + 0.1,
    [
      [1174, 1],
      [2348, 0.12],
    ],
    0.14,
    0.3,
  )
  playTone(synth, now + 0.24, 1318, 0.05, 0.2)
}

function playGentleGlow(synth: Synth) {
  const { now } = synth
  playDrawerNoise(synth, now, 0.022, 0.12, 480)
  playTone(synth, now + 0.06, 640, 0.09, 0.14, 'sine')
  playTone(synth, now + 0.16, 932, 0.11, 0.2, 'sine')
  playTone(synth, now + 0.26, 1108, 0.05, 0.18)
}

function playEarnWhisper(synth: Synth) {
  const { now } = synth
  playTone(synth, now + 0.02, 740, 0.09, 0.14, 'sine', 600)
  playSoftEarnBell(synth, now + 0.1, 0.12)
  playTone(synth, now + 0.24, 1480, 0.045, 0.24)
}

function playPayoutGlow(synth: Synth) {
  const { now } = synth
  playTone(synth, now, 660, 0.1, 0.14, 'sine')
  playTone(synth, now + 0.1, 932, 0.11, 0.18, 'sine')
  playSoftEarnBell(synth, now + 0.2, 0.14)
  playTone(synth, now + 0.32, 1174, 0.045, 0.16)
}

function playRegisterHush(synth: Synth) {
  const { now } = synth
  playDrawerNoise(synth, now, 0.028, 0.08, 500)
  playTone(synth, now + 0.06, 700, 0.09, 0.14, 'sine', 580)
  playBell(
    synth,
    now + 0.12,
    [
      [1108, 1],
      [2216, 0.1],
    ],
    0.1,
    0.26,
  )
}

const VARIANT_PLAYERS: Record<PromoRewardSoundVariant, (synth: Synth) => void> = {
  'cha-ching': playChaChing,
  'coin-stack': playCoinStack,
  'cash-drawer': playCashDrawer,
  'soft-earn': playSoftEarn,
  'soft-drawer': playSoftDrawer,
  'drawer-earn': playDrawerEarn,
  'warm-register': playWarmRegister,
  'gentle-payout': playGentlePayout,
  'soft-cash-combo': playSoftCashCombo,
  'register-glow': playRegisterGlow,
  'glow-trio': playGlowTrio,
  'glow-earn': playGlowEarn,
  'glow-payout': playGlowPayout,
  'whisper-glow': playWhisperGlow,
  'soft-glow': playSoftGlow,
  'gentle-glow': playGentleGlow,
  'earn-whisper': playEarnWhisper,
  'payout-glow': playPayoutGlow,
  'register-hush': playRegisterHush,
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
