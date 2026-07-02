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

/** Maps extended letter grades to harmonized CSS variables in globals.css. */
export function gradeColor(letter: string): string {
  if (letter === 'F') return 'var(--grade-f)'
  if (letter.startsWith('A')) return 'var(--grade-a)'
  if (letter.startsWith('B')) return 'var(--grade-b)'
  if (letter.startsWith('C')) return 'var(--grade-c)'
  return 'var(--grade-d)' // D+, D, D-
}
