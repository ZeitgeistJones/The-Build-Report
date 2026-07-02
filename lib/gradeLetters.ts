export function pctToLetter(pct: number): string {
  if (pct >= 97) return 'A+'
  if (pct >= 93) return 'A'
  if (pct >= 90) return 'A-'
  if (pct >= 87) return 'B+'
  if (pct >= 83) return 'B'
  if (pct >= 80) return 'B-'
  if (pct >= 77) return 'C+'
  if (pct >= 73) return 'C'
  if (pct >= 70) return 'C-'
  if (pct >= 67) return 'D+'
  if (pct >= 63) return 'D'
  if (pct >= 60) return 'D-'
  return 'F'
}

/** Maps extended letter grades to existing palette buckets. F uses muted gray — terminal, not a low D. */
export function gradeColor(letter: string): string {
  if (letter === 'F') return 'var(--text-muted)'
  if (letter.startsWith('A')) return 'var(--accent)'
  if (letter.startsWith('B')) return 'var(--green)'
  if (letter.startsWith('C')) return 'var(--amber)'
  return 'var(--red)' // D+, D, D-
}
