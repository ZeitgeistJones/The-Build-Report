const SOUND_PREF_KEY = 'promo-reward-sound'

export type PromoRewardSoundGroup = 'touchdown-pitch' | 'payoff-final' | 'payoff' | 'glow-payout' | 'glow' | 'soft' | 'combo' | 'drawer' | 'classic'

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
  | 'glow-payout-warm'
  | 'glow-payout-deep'
  | 'glow-payout-hush'
  | 'glow-payout-quick'
  | 'glow-payout-linger'
  | 'glow-payout-minimal'
  | 'glow-payout-rustle'
  | 'glow-payout-tail'
  | 'glow-payout-dusk'
  | 'glow-payout-warm-quick'
  | 'glow-payout-sweet'
  | 'glow-payout-snappy'
  | 'glow-payout-warm-snap'
  | 'glow-payout-almost'
  | 'glow-payout-payoff'
  | 'glow-payout-arrival'
  | 'glow-payout-settle'
  | 'glow-payout-rewarded'
  | 'glow-payout-waited'
  | 'glow-payout-landed'
  | 'glow-payout-payoff-warm'
  | 'glow-payout-payoff-sweet-landed'
  | 'glow-payout-payoff-touchdown'
  | 'glow-payout-payoff-rest'
  | 'glow-payout-payoff-merge'
  | 'glow-payout-payoff-landed-hush'
  | 'glow-payout-payoff-sweet-linger'
  | 'glow-payout-payoff-touchdown-sweet'
  | 'glow-payout-payoff-touchdown-merge'
  | 'glow-payout-payoff-sweet-soft-rustle'
  | 'glow-payout-payoff-touchdown-settle'
  | 'glow-payout-payoff-sweet-breathe'
  | 'glow-payout-payoff-touchdown-warm'
  | 'glow-payout-payoff-touchdown-lift'
  | 'glow-payout-payoff-sweet-touch'
  | 'glow-payout-touchdown-pitch-deep'
  | 'glow-payout-touchdown-pitch-low'
  | 'glow-payout-touchdown-pitch-gold'
  | 'glow-payout-touchdown-pitch-warm'
  | 'glow-payout-touchdown-pitch-mid'
  | 'glow-payout-touchdown-pitch-cool'
  | 'glow-payout-touchdown-pitch-airy'
  | 'glow-payout-touchdown-pitch-bright'
  | 'glow-payout-touchdown-pitch-hush'
  | 'whisper-glow'
  | 'soft-glow'
  | 'gentle-glow'
  | 'earn-whisper'
  | 'payout-glow'
  | 'register-hush'

export const PROMO_REWARD_PREVIEW_WAIT_MS = 5000

export const PROMO_REWARD_SOUND_GROUPS: { id: PromoRewardSoundGroup; label: string }[] = [
  { id: 'touchdown-pitch', label: 'Touchdown — pitch variants only' },
  { id: 'payoff-final', label: 'Touchdown + sweet land blends' },
  { id: 'payoff', label: 'Other after-the-wait payoff' },
  { id: 'glow-payout', label: 'Glow payout variants' },
  { id: 'glow', label: 'Glow family' },
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
  finalist?: boolean
}[] = [
  {
    id: 'glow-payout-payoff-touchdown',
    label: 'Touchdown · base pitch',
    hint: 'Reference — light rustle, [620 · 934 · 1108] Hz pings.',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-touchdown-pitch-deep',
    label: 'Touchdown · deep',
    hint: 'Lower pitch — [560 · 840 · 1000].',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-touchdown-pitch-low',
    label: 'Touchdown · low',
    hint: 'Lowest — [540 · 810 · 960].',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-touchdown-pitch-gold',
    label: 'Touchdown · gold',
    hint: 'Warm-low — [590 · 885 · 1050].',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-touchdown-pitch-warm',
    label: 'Touchdown · warm pitch',
    hint: 'Slightly lower — [610 · 920 · 1095].',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-touchdown-pitch-mid',
    label: 'Touchdown · mid',
    hint: 'Between warm and base — [600 · 900 · 1070].',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-touchdown-pitch-hush',
    label: 'Touchdown · hush pitch',
    hint: 'Landed-style low notes on touchdown — [580 · 870 · 1034].',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-touchdown-pitch-cool',
    label: 'Touchdown · cool',
    hint: 'A bit higher — [640 · 960 · 1140].',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-touchdown-pitch-airy',
    label: 'Touchdown · airy',
    hint: 'Higher, lighter — [660 · 990 · 1175].',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-touchdown-pitch-bright',
    label: 'Touchdown · bright',
    hint: 'Highest — [680 · 1020 · 1210].',
    group: 'touchdown-pitch',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-payoff',
    label: 'Payoff · sweet land',
    hint: 'Your finalist — fuller rustle, sweet payout tones after the wait.',
    group: 'payoff-final',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-payoff-touchdown',
    label: 'Payoff · touchdown',
    hint: 'Your finalist — lighter rustle, same sweet payout shape.',
    group: 'payoff-final',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-payoff-touchdown-sweet',
    label: 'Payoff · touchdown + sweet',
    hint: 'Blend — medium rustle between touchdown and sweet land.',
    group: 'payoff-final',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-payoff-touchdown-merge',
    label: 'Payoff · touchdown merge',
    hint: 'Mid rustle + longer final settle from sweet land.',
    group: 'payoff-final',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-payoff-sweet-soft-rustle',
    label: 'Payoff · sweet soft rustle',
    hint: 'Sweet land with rustle pulled toward touchdown.',
    group: 'payoff-final',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-payoff-touchdown-settle',
    label: 'Payoff · touchdown settle',
    hint: 'Touchdown rustle + longer decay on the last ping.',
    group: 'payoff-final',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-payoff-sweet-breathe',
    label: 'Payoff · sweet breathe',
    hint: 'Sweet land slowed slightly — more air between pings.',
    group: 'payoff-final',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-payoff-touchdown-lift',
    label: 'Payoff · touchdown lift',
    hint: 'Touchdown with a touch more presence on the middle ping.',
    group: 'payoff-final',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-payoff-sweet-touch',
    label: 'Payoff · sweet touch',
    hint: 'Sweet land softened — rustle between touchdown and sweet.',
    group: 'payoff-final',
    pick: true,
    finalist: true,
  },
  {
    id: 'glow-payout-landed',
    label: 'Payoff · landed',
    hint: 'Light rustle, warm pings, lingering finish.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-payoff-sweet-landed',
    label: 'Payoff · sweet + landed',
    hint: 'Blend of sweet land and landed.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-payoff-merge',
    label: 'Payoff · merge',
    hint: 'Midpoint between sweet land and landed.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-payoff-rest',
    label: 'Payoff · rest',
    hint: 'Quietest rustle, sweet tones, longest settle.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-payoff-sweet-linger',
    label: 'Payoff · sweet linger',
    hint: 'Sweet land with landed’s longer tail decay.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-payoff-landed-hush',
    label: 'Payoff · landed hush',
    hint: 'Landed turned down a notch.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-arrival',
    label: 'Payoff · arrival',
    hint: 'Rustle, brief pause, then warm pings — “result showed up”.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-payoff-warm',
    label: 'Payoff · warm land',
    hint: 'Warm glow payout with space to breathe after the wait.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-settle',
    label: 'Payoff · settle',
    hint: 'Warm cascade + soft tail — money landed and settled.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-rewarded',
    label: 'Payoff · rewarded',
    hint: 'Mid-warm tones, unhurried rhythm, stronger final note.',
    group: 'payoff',
  },
  {
    id: 'glow-payout-waited',
    label: 'Payoff · waited',
    hint: 'For the “I sat through Scoring…” moment — cozy, not snappy.',
    group: 'payoff',
  },
  {
    id: 'glow-payout',
    label: 'Glow payout',
    hint: 'Base — rustle into three gentle pings.',
    group: 'glow-payout',
    pick: true,
  },
  {
    id: 'glow-payout-warm',
    label: 'Glow payout · warm',
    hint: 'Lower, rounder pings — close but not quite.',
    group: 'glow-payout',
    pick: true,
  },
  {
    id: 'glow-payout-quick',
    label: 'Glow payout · quick',
    hint: 'Snappier timing — interesting edge.',
    group: 'glow-payout',
    pick: true,
  },
  {
    id: 'glow-payout-warm-quick',
    label: 'Glow payout · warm + quick',
    hint: 'Your two near-misses combined — cozy tones, tight timing.',
    group: 'glow-payout',
    pick: true,
  },
  {
    id: 'glow-payout-sweet',
    label: 'Glow payout · sweet spot',
    hint: 'Halfway between base and warm, medium-snappy timing.',
    group: 'glow-payout',
    pick: true,
  },
  {
    id: 'glow-payout-warm-snap',
    label: 'Glow payout · warm snap',
    hint: 'Warm tones + quick rhythm, softened so it doesn’t feel rushed.',
    group: 'glow-payout',
    pick: true,
  },
  {
    id: 'glow-payout-snappy',
    label: 'Glow payout · snappy',
    hint: 'Base pitch + quick timing, middle ping pops a touch more.',
    group: 'glow-payout',
    pick: true,
  },
  {
    id: 'glow-payout-almost',
    label: 'Glow payout · almost',
    hint: 'Barely warmer than base, slightly quicker — micro-tweak.',
    group: 'glow-payout',
    pick: true,
  },
  {
    id: 'glow-payout-deep',
    label: 'Glow payout · deep',
    hint: 'Deeper rustle and lower notes — more weight, still soft.',
    group: 'glow-payout',
  },
  {
    id: 'glow-payout-dusk',
    label: 'Glow payout · dusk',
    hint: 'Warm + deep + a little more space between pings.',
    group: 'glow-payout',
  },
  {
    id: 'glow-payout-hush',
    label: 'Glow payout · hush',
    hint: 'Same shape, quieter — subtle background earn.',
    group: 'glow-payout',
  },
  {
    id: 'glow-payout-linger',
    label: 'Glow payout · linger',
    hint: 'More space and longer decay — relaxed landing.',
    group: 'glow-payout',
  },
  {
    id: 'glow-payout-minimal',
    label: 'Glow payout · minimal',
    hint: 'Less rustle, pings carry more of the moment.',
    group: 'glow-payout',
  },
  {
    id: 'glow-payout-rustle',
    label: 'Glow payout · rustle',
    hint: 'More register texture, slightly softer pings.',
    group: 'glow-payout',
  },
  {
    id: 'glow-payout-tail',
    label: 'Glow payout · tail',
    hint: 'Base glow payout + tiny warm tail at the end.',
    group: 'glow-payout',
  },
  {
    id: 'glow-trio',
    label: 'Glow trio',
    hint: 'Register rustle, gentle pings, soft earn finish.',
    group: 'glow',
  },
  {
    id: 'register-glow',
    label: 'Register glow',
    hint: 'Drawer rustle under a soft glowing payout tone.',
    group: 'glow',
  },
  {
    id: 'glow-earn',
    label: 'Glow earn',
    hint: 'Register glow opening with a clearer soft-earn bell.',
    group: 'glow',
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

function playGlowPayoutBase(
  synth: Synth,
  {
    rustleScale = 0.9,
    pingOffset = 0.1,
    pingGap = 0.1,
    freqs = [660, 988, 1174],
    peaks = [0.1, 0.12, 0.06],
    decays = [0.14, 0.2, 0.16],
    tail,
  }: {
    rustleScale?: number
    pingOffset?: number
    pingGap?: number
    freqs?: [number, number, number]
    peaks?: [number, number, number]
    decays?: [number, number, number]
    tail?: { offset: number; freq: number; peak: number; decay: number }
  } = {},
) {
  const { now } = synth
  playRegisterGlowRustle(synth, now, rustleScale)
  for (let i = 0; i < 3; i++) {
    playTone(synth, now + pingOffset + pingGap * i, freqs[i], peaks[i], decays[i], 'sine')
  }
  if (tail) {
    playTone(synth, now + tail.offset, tail.freq, tail.peak, tail.decay, 'sine')
  }
}

function playGlowPayout(synth: Synth) {
  playGlowPayoutBase(synth)
}

function playGlowPayoutWarm(synth: Synth) {
  playGlowPayoutBase(synth, {
    freqs: [580, 880, 1046],
    peaks: [0.095, 0.11, 0.055],
  })
}

function playGlowPayoutDeep(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 1.05,
    freqs: [520, 784, 988],
    peaks: [0.105, 0.115, 0.058],
  })
}

function playGlowPayoutDusk(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.95,
    pingOffset: 0.11,
    pingGap: 0.12,
    freqs: [554, 830, 988],
    peaks: [0.09, 0.11, 0.055],
    decays: [0.16, 0.22, 0.18],
  })
}

function playGlowPayoutHush(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.6,
    peaks: [0.075, 0.09, 0.045],
  })
}

function playGlowPayoutQuick(synth: Synth) {
  playGlowPayoutBase(synth, {
    pingOffset: 0.08,
    pingGap: 0.07,
    decays: [0.12, 0.16, 0.13],
  })
}

function playGlowPayoutLinger(synth: Synth) {
  playGlowPayoutBase(synth, {
    pingOffset: 0.11,
    pingGap: 0.13,
    decays: [0.18, 0.24, 0.2],
  })
}

function playGlowPayoutMinimal(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.5,
    peaks: [0.11, 0.13, 0.07],
  })
}

function playGlowPayoutRustle(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 1.2,
    peaks: [0.085, 0.1, 0.05],
  })
}

function playGlowPayoutTail(synth: Synth) {
  playGlowPayoutBase(synth, {
    tail: { offset: 0.38, freq: 1046, peak: 0.05, decay: 0.18 },
  })
}

function playGlowPayoutWarmQuick(synth: Synth) {
  playGlowPayoutBase(synth, {
    pingOffset: 0.08,
    pingGap: 0.07,
    freqs: [580, 880, 1046],
    peaks: [0.1, 0.115, 0.058],
    decays: [0.12, 0.17, 0.14],
  })
}

function playGlowPayoutSweet(synth: Synth) {
  playGlowPayoutBase(synth, {
    pingOffset: 0.085,
    pingGap: 0.085,
    freqs: [620, 934, 1108],
    peaks: [0.1, 0.12, 0.058],
    decays: [0.13, 0.18, 0.15],
  })
}

function playGlowPayoutWarmSnap(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.82,
    pingOffset: 0.085,
    pingGap: 0.075,
    freqs: [590, 892, 1058],
    peaks: [0.095, 0.11, 0.055],
    decays: [0.13, 0.18, 0.16],
  })
}

function playGlowPayoutSnappy(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.8,
    pingOffset: 0.08,
    pingGap: 0.07,
    peaks: [0.1, 0.13, 0.06],
    decays: [0.12, 0.16, 0.13],
  })
}

function playGlowPayoutAlmost(synth: Synth) {
  playGlowPayoutBase(synth, {
    pingOffset: 0.085,
    pingGap: 0.085,
    freqs: [640, 948, 1120],
    peaks: [0.1, 0.12, 0.058],
    decays: [0.13, 0.18, 0.15],
  })
}

function playGlowPayoutPayoff(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.85,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs: [620, 934, 1108],
    peaks: [0.1, 0.12, 0.07],
    decays: [0.16, 0.22, 0.24],
  })
}

function playGlowPayoutArrival(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.88,
    pingOffset: 0.14,
    pingGap: 0.11,
    freqs: [600, 900, 1068],
    peaks: [0.095, 0.115, 0.065],
    decays: [0.15, 0.21, 0.23],
  })
}

function playGlowPayoutPayoffWarm(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.82,
    pingOffset: 0.13,
    pingGap: 0.11,
    freqs: [580, 880, 1046],
    peaks: [0.1, 0.115, 0.068],
    decays: [0.16, 0.22, 0.25],
  })
}

function playGlowPayoutSettle(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.8,
    pingOffset: 0.12,
    pingGap: 0.12,
    freqs: [590, 892, 1058],
    peaks: [0.095, 0.11, 0.065],
    decays: [0.17, 0.23, 0.26],
    tail: { offset: 0.46, freq: 988, peak: 0.045, decay: 0.22 },
  })
}

function playGlowPayoutRewarded(synth: Synth) {
  playGlowPayoutBase(synth, {
    pingOffset: 0.11,
    pingGap: 0.11,
    freqs: [610, 920, 1096],
    peaks: [0.095, 0.125, 0.075],
    decays: [0.15, 0.2, 0.26],
  })
}

function playGlowPayoutWaited(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.9,
    pingOffset: 0.13,
    pingGap: 0.12,
    freqs: [600, 880, 1046],
    peaks: [0.09, 0.11, 0.07],
    decays: [0.18, 0.24, 0.28],
  })
}

function playGlowPayoutLanded(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.65,
    pingOffset: 0.12,
    pingGap: 0.1,
    freqs: [580, 870, 1034],
    peaks: [0.1, 0.12, 0.072],
    decays: [0.16, 0.22, 0.27],
  })
}

function playGlowPayoutPayoffSweetLanded(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.75,
    pingOffset: 0.12,
    pingGap: 0.105,
    freqs: [600, 902, 1071],
    peaks: [0.1, 0.12, 0.071],
    decays: [0.16, 0.22, 0.255],
  })
}

function playGlowPayoutPayoffMerge(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.725,
    pingOffset: 0.12,
    pingGap: 0.102,
    freqs: [600, 902, 1071],
    peaks: [0.1, 0.12, 0.071],
    decays: [0.16, 0.22, 0.262],
  })
}

function playTouchdownPitch(synth: Synth, freqs: [number, number, number]) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.65,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs,
    peaks: [0.1, 0.12, 0.07],
    decays: [0.16, 0.22, 0.24],
  })
}

function playGlowPayoutPayoffTouchdown(synth: Synth) {
  playTouchdownPitch(synth, [620, 934, 1108])
}

function playTouchdownPitchDeep(synth: Synth) {
  playTouchdownPitch(synth, [560, 840, 1000])
}

function playTouchdownPitchLow(synth: Synth) {
  playTouchdownPitch(synth, [540, 810, 960])
}

function playTouchdownPitchGold(synth: Synth) {
  playTouchdownPitch(synth, [590, 885, 1050])
}

function playTouchdownPitchWarm(synth: Synth) {
  playTouchdownPitch(synth, [610, 920, 1095])
}

function playTouchdownPitchMid(synth: Synth) {
  playTouchdownPitch(synth, [600, 900, 1070])
}

function playTouchdownPitchHush(synth: Synth) {
  playTouchdownPitch(synth, [580, 870, 1034])
}

function playTouchdownPitchCool(synth: Synth) {
  playTouchdownPitch(synth, [640, 960, 1140])
}

function playTouchdownPitchAiry(synth: Synth) {
  playTouchdownPitch(synth, [660, 990, 1175])
}

function playTouchdownPitchBright(synth: Synth) {
  playTouchdownPitch(synth, [680, 1020, 1210])
}

function playGlowPayoutPayoffTouchdownSweet(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.75,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs: [620, 934, 1108],
    peaks: [0.1, 0.12, 0.07],
    decays: [0.16, 0.22, 0.24],
  })
}

function playGlowPayoutPayoffTouchdownMerge(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.75,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs: [620, 934, 1108],
    peaks: [0.1, 0.12, 0.07],
    decays: [0.16, 0.22, 0.27],
  })
}

function playGlowPayoutPayoffSweetSoftRustle(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.78,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs: [620, 934, 1108],
    peaks: [0.1, 0.12, 0.07],
    decays: [0.16, 0.22, 0.24],
  })
}

function playGlowPayoutPayoffTouchdownSettle(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.65,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs: [620, 934, 1108],
    peaks: [0.1, 0.12, 0.072],
    decays: [0.16, 0.23, 0.28],
  })
}

function playGlowPayoutPayoffSweetBreathe(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.85,
    pingOffset: 0.12,
    pingGap: 0.115,
    freqs: [620, 934, 1108],
    peaks: [0.098, 0.118, 0.068],
    decays: [0.17, 0.23, 0.26],
  })
}

function playGlowPayoutPayoffTouchdownWarm(synth: Synth) {
  playTouchdownPitchWarm(synth)
}

function playGlowPayoutPayoffTouchdownLift(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.68,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs: [620, 934, 1108],
    peaks: [0.1, 0.125, 0.072],
    decays: [0.16, 0.22, 0.25],
  })
}

function playGlowPayoutPayoffSweetTouch(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.72,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs: [620, 934, 1108],
    peaks: [0.098, 0.118, 0.068],
    decays: [0.16, 0.22, 0.25],
  })
}

function playGlowPayoutPayoffRest(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.58,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs: [620, 934, 1108],
    peaks: [0.095, 0.115, 0.068],
    decays: [0.17, 0.24, 0.3],
  })
}

function playGlowPayoutPayoffSweetLinger(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.85,
    pingOffset: 0.12,
    pingGap: 0.11,
    freqs: [620, 934, 1108],
    peaks: [0.1, 0.12, 0.07],
    decays: [0.16, 0.22, 0.28],
  })
}

function playGlowPayoutPayoffLandedHush(synth: Synth) {
  playGlowPayoutBase(synth, {
    rustleScale: 0.65,
    pingOffset: 0.12,
    pingGap: 0.1,
    freqs: [580, 870, 1034],
    peaks: [0.085, 0.1, 0.06],
    decays: [0.17, 0.23, 0.28],
  })
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
  'glow-payout-warm': playGlowPayoutWarm,
  'glow-payout-deep': playGlowPayoutDeep,
  'glow-payout-dusk': playGlowPayoutDusk,
  'glow-payout-hush': playGlowPayoutHush,
  'glow-payout-quick': playGlowPayoutQuick,
  'glow-payout-linger': playGlowPayoutLinger,
  'glow-payout-minimal': playGlowPayoutMinimal,
  'glow-payout-rustle': playGlowPayoutRustle,
  'glow-payout-tail': playGlowPayoutTail,
  'glow-payout-warm-quick': playGlowPayoutWarmQuick,
  'glow-payout-sweet': playGlowPayoutSweet,
  'glow-payout-warm-snap': playGlowPayoutWarmSnap,
  'glow-payout-snappy': playGlowPayoutSnappy,
  'glow-payout-almost': playGlowPayoutAlmost,
  'glow-payout-payoff': playGlowPayoutPayoff,
  'glow-payout-arrival': playGlowPayoutArrival,
  'glow-payout-settle': playGlowPayoutSettle,
  'glow-payout-rewarded': playGlowPayoutRewarded,
  'glow-payout-waited': playGlowPayoutWaited,
  'glow-payout-landed': playGlowPayoutLanded,
  'glow-payout-payoff-warm': playGlowPayoutPayoffWarm,
  'glow-payout-payoff-sweet-landed': playGlowPayoutPayoffSweetLanded,
  'glow-payout-payoff-touchdown': playGlowPayoutPayoffTouchdown,
  'glow-payout-payoff-rest': playGlowPayoutPayoffRest,
  'glow-payout-payoff-merge': playGlowPayoutPayoffMerge,
  'glow-payout-payoff-landed-hush': playGlowPayoutPayoffLandedHush,
  'glow-payout-payoff-sweet-linger': playGlowPayoutPayoffSweetLinger,
  'glow-payout-payoff-touchdown-sweet': playGlowPayoutPayoffTouchdownSweet,
  'glow-payout-payoff-touchdown-merge': playGlowPayoutPayoffTouchdownMerge,
  'glow-payout-payoff-sweet-soft-rustle': playGlowPayoutPayoffSweetSoftRustle,
  'glow-payout-payoff-touchdown-settle': playGlowPayoutPayoffTouchdownSettle,
  'glow-payout-payoff-sweet-breathe': playGlowPayoutPayoffSweetBreathe,
  'glow-payout-payoff-touchdown-warm': playGlowPayoutPayoffTouchdownWarm,
  'glow-payout-payoff-touchdown-lift': playGlowPayoutPayoffTouchdownLift,
  'glow-payout-payoff-sweet-touch': playGlowPayoutPayoffSweetTouch,
  'glow-payout-touchdown-pitch-deep': playTouchdownPitchDeep,
  'glow-payout-touchdown-pitch-low': playTouchdownPitchLow,
  'glow-payout-touchdown-pitch-gold': playTouchdownPitchGold,
  'glow-payout-touchdown-pitch-warm': playTouchdownPitchWarm,
  'glow-payout-touchdown-pitch-mid': playTouchdownPitchMid,
  'glow-payout-touchdown-pitch-hush': playTouchdownPitchHush,
  'glow-payout-touchdown-pitch-cool': playTouchdownPitchCool,
  'glow-payout-touchdown-pitch-airy': playTouchdownPitchAiry,
  'glow-payout-touchdown-pitch-bright': playTouchdownPitchBright,
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
