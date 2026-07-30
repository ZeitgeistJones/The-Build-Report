/** Web Audio “execute burn” whoosh — primed on click so wallets don’t block it. */

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

function envGain(ctx: AudioContext, start: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + decay)
  g.connect(ctx.destination)
  return g
}

function playNoiseBurst(
  ctx: AudioContext,
  start: number,
  duration: number,
  peak: number,
  centerHz: number,
  q = 0.6,
  type: BiquadFilterType = 'bandpass',
) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    // Soften toward the end so crackles don’t click.
    const t = i / length
    data[i] = (Math.random() * 2 - 1) * (1 - t * 0.35)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(centerHz, start)
  filter.Q.value = q
  const gain = envGain(ctx, start, peak, 0.012, duration)
  src.connect(filter)
  filter.connect(gain)
  src.start(start)
  src.stop(start + duration)
}

function playTone(
  ctx: AudioContext,
  start: number,
  freq: number,
  peak: number,
  decay: number,
  type: OscillatorType = 'sine',
  slideTo?: number,
) {
  const gain = envGain(ctx, start, peak, 0.01, decay)
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, start + decay * 0.85)
  }
  osc.connect(gain)
  osc.start(start)
  osc.stop(start + decay)
}

/**
 * Cool burn: ignition thud → fire whoosh → crackle → falling ember tones.
 * Plays immediately after the user clicks Execute burn.
 */
export function playBurnClickSound() {
  if (typeof window === 'undefined' || prefersReducedMotion()) return
  const ctx = getAudioContext()
  if (!ctx || ctx.state === 'closed') return

  const now = ctx.currentTime

  // Ignition — low body hit
  playTone(ctx, now, 90, 0.22, 0.18, 'triangle', 55)
  playTone(ctx, now, 140, 0.1, 0.12, 'sine', 80)

  // Whoosh — broad noise sweeping down (heat rush)
  playNoiseBurst(ctx, now + 0.02, 0.42, 0.2, 900, 0.55, 'lowpass')
  const whoosh = ctx.createBufferSource()
  {
    const length = Math.floor(ctx.sampleRate * 0.5)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    whoosh.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.85
    filter.frequency.setValueAtTime(1800, now + 0.04)
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.48)
    const gain = envGain(ctx, now + 0.04, 0.16, 0.04, 0.5)
    whoosh.connect(filter)
    filter.connect(gain)
    whoosh.start(now + 0.04)
    whoosh.stop(now + 0.54)
  }

  // Crackles — short hot sparks
  const crackles: [number, number, number][] = [
    [0.1, 0.035, 2400],
    [0.16, 0.028, 3200],
    [0.22, 0.04, 1900],
    [0.29, 0.022, 4100],
    [0.35, 0.03, 2700],
    [0.42, 0.018, 3600],
  ]
  for (const [offset, peak, hz] of crackles) {
    playNoiseBurst(ctx, now + offset, 0.045, peak, hz, 1.4, 'bandpass')
  }

  // Ember tones — warm descending settle
  playTone(ctx, now + 0.18, 420, 0.09, 0.28, 'sine', 260)
  playTone(ctx, now + 0.32, 310, 0.07, 0.34, 'sine', 180)
  playTone(ctx, now + 0.48, 220, 0.05, 0.4, 'triangle', 110)
}
