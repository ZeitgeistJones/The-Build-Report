import type { Level } from '@/lib/scores'

export function parseWeightPct(weight: string): number {
  if (weight === 'equal') return 20
  const n = parseFloat(weight)
  return Number.isFinite(n) ? n : 0
}

export function levelToScorePct(level: Level): number {
  if (level === 'high') return 100
  if (level === 'mid') return 67
  return 33
}

export function rubricRowPoints(weight: string, level: Level): { earned: number; max: number } {
  const max = parseWeightPct(weight)
  const earned = Math.round((max * levelToScorePct(level)) / 100)
  return { earned, max }
}

export const LEVEL_BAR_COLORS: Record<Level, string> = {
  high: '#5cb87a',
  mid: '#d4943a',
  low: '#e05c5c',
}
