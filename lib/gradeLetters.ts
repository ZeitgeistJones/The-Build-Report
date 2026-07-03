/** Map numeric score (0–100) to letter grade. F is below 60%. */
export function pctToLetter(pct: number): string {
  const n = Math.round(Math.max(0, Math.min(100, pct)))
  if (n >= 97) return 'A+'
  if (n >= 93) return 'A'
  if (n >= 90) return 'A-'
  if (n >= 87) return 'B+'
  if (n >= 83) return 'B'
  if (n >= 80) return 'B-'
  if (n >= 77) return 'C+'
  if (n >= 73) return 'C'
  if (n >= 70) return 'C-'
  if (n >= 67) return 'D+'
  if (n >= 63) return 'D'
  if (n >= 60) return 'D-'
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
