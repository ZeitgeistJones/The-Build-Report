/**
 * Daily Loop masthead wordmark — LOOP’s O’s are open arcs with opposite gaps.
 */

function LoopO({ gap = 'top-left' }: { gap?: 'top-left' | 'bottom-right' }) {
  // Circumference ≈ 138. Open ring leaves a small gap (~22).
  // Default dash starts at 3 o'clock; offset rotates the gap.
  const dash = '116 22'
  const offset = gap === 'top-left' ? '28' : '97'

  return (
    <svg
      className="daily-loop-o"
      viewBox="0 0 72 72"
      aria-hidden
      focusable="false"
    >
      <circle
        cx="36"
        cy="36"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeDasharray={dash}
        strokeDashoffset={offset}
        strokeLinecap="butt"
      />
    </svg>
  )
}

export default function DailyLoopWordmark() {
  return (
    <>
      <span className="daily-loop-sr">The Daily Loop</span>
      <span className="daily-loop-wordmark" aria-hidden="true">
        <span>The Daily L</span>
        <LoopO gap="top-left" />
        <LoopO gap="bottom-right" />
        <span>P</span>
      </span>
    </>
  )
}
