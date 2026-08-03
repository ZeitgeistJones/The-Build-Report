/** Web Audio “execute burn” — primed on click so wallets don’t block it. */

let primedAudioContext: AudioContext | null = null

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioCtx =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null

  if (!primedAudioContext || primedAudioContext.state === 'closed') {
    primedAudioContext = new AudioCtx()
  }
  if (primedAudioContext.state === 'suspended') {
    void primedAudioContext.resume()
  }
  return primedAudioContext
}

/** Call at the start of the burn click so later playback isn’t blocked. */
export function primeBurnAudio() {
  if (prefersReducedMotion()) return
  getAudioContext()
}

function envGain(
  ctx: AudioContext,
  start: number,
  peak: number,
  attack: number,
  decay: number,
  destination: AudioNode = ctx.destination,
) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + decay)
  g.connect(destination)
  return g
}

/** Pink-ish noise — warmer / less “laser static” than raw white. */
function fillPinkNoise(data: Float32Array) {
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99765 * b0 + white * 0.099046
    b1 = 0.963 * b1 + white * 0.2965164
    b2 = 0.5701 * b2 + white * 1.0526913
    const pink = b0 + b1 + b2 + white * 0.1848
    // Soft fade so buffer edges never click.
    const t = i / data.length
    const edge = t < 0.02 ? t / 0.02 : t > 0.85 ? (1 - t) / 0.15 : 1
    data[i] = pink * 0.22 * edge
  }
}

function playFilteredNoise(
  ctx: AudioContext,
  start: number,
  duration: number,
  peak: number,
  opts: {
    type: BiquadFilterType
    freqStart: number
    freqEnd?: number
    q?: number
    attack?: number
  },
) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  fillPinkNoise(buffer.getChannelData(0))

  const src = ctx.createBufferSource()
  src.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = opts.type
  filter.Q.value = opts.q ?? 0.7
  filter.frequency.setValueAtTime(opts.freqStart, start)
  if (opts.freqEnd != null && opts.freqEnd !== opts.freqStart) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(opts.freqEnd, 40),
      start + duration * 0.92,
    )
  }

  const attack = opts.attack ?? 0.012
  const gain = envGain(ctx, start, peak, attack, duration)
  src.connect(filter)
  filter.connect(gain)
  src.start(start)
  src.stop(start + duration + 0.02)
}

/**
 * Classic burn: match-strike → sharp flame whoosh → brief ember hiss.
 * Short and dry — no sci-fi laser swoosh or musical settle tones.
 */
export function playBurnClickSound() {
  if (typeof window === 'undefined' || prefersReducedMotion()) return
  const ctx = getAudioContext()
  if (!ctx || ctx.state === 'closed') return

  const now = ctx.currentTime

  // 1) Match strike — bright, instant snap (the “classic” ignition)
  playFilteredNoise(ctx, now, 0.045, 0.2, {
    type: 'highpass',
    freqStart: 2800,
    q: 0.5,
    attack: 0.002,
  })
  playFilteredNoise(ctx, now, 0.03, 0.12, {
    type: 'bandpass',
    freqStart: 5200,
    q: 1.8,
    attack: 0.001,
  })

  // 2) Flame body — mid roar that collapses fast (paper/torch, not a spaceship)
  playFilteredNoise(ctx, now + 0.018, 0.28, 0.24, {
    type: 'bandpass',
    freqStart: 1100,
    freqEnd: 380,
    q: 0.75,
    attack: 0.018,
  })
  // Soft low heat under the whoosh — noise only, never a musical oscillator
  playFilteredNoise(ctx, now + 0.02, 0.22, 0.07, {
    type: 'lowpass',
    freqStart: 220,
    freqEnd: 90,
    q: 0.5,
    attack: 0.025,
  })

  // 3) Two sparse crackles — fire, not machine-gun sparks
  playFilteredNoise(ctx, now + 0.11, 0.028, 0.045, {
    type: 'bandpass',
    freqStart: 3100,
    q: 2.2,
    attack: 0.001,
  })
  playFilteredNoise(ctx, now + 0.19, 0.022, 0.032, {
    type: 'bandpass',
    freqStart: 2400,
    q: 1.6,
    attack: 0.001,
  })

  // 4) Ember hiss tail — quiet air after the flame, no descending tones
  playFilteredNoise(ctx, now + 0.2, 0.2, 0.035, {
    type: 'highpass',
    freqStart: 1600,
    freqEnd: 900,
    q: 0.4,
    attack: 0.04,
  })
}
