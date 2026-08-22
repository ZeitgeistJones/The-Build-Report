/**
 * Daily Loop masthead wordmark — LOOP’s O’s are looping strokes, not font O’s.
 */

function LoopO({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className="daily-loop-o"
      viewBox="0 0 72 72"
      aria-hidden
      focusable="false"
    >
      <path
        d="M23 19 A 20 20 0 1 1 22 53 A 16 16 0 1 1 41 23"
        fill="none"
        stroke="currentColor"
        strokeWidth="12.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={flip ? 'rotate(180 36 36)' : undefined}
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
        <LoopO />
        <LoopO flip />
        <span>P</span>
      </span>
    </>
  )
}
