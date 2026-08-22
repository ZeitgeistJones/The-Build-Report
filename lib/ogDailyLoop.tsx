import { ImageResponse } from 'next/og'

export const DAILY_LOOP_OG_ALT = 'The Daily Loop — Stay in it.'
export const DAILY_LOOP_OG_SIZE = { width: 1200, height: 630 }
export const DAILY_LOOP_OG_CONTENT_TYPE = 'image/png'

const PAPER = '#FAFAFA'
const RED = '#8B2323'
const INK = '#111111'

function OpenO({ gap }: { gap: 'top-left' | 'bottom-right' }) {
  const dash = '116 22'
  const offset = gap === 'top-left' ? '28' : '97'
  return (
    <svg width="78" height="78" viewBox="0 0 72 72">
      <circle
        cx="36"
        cy="36"
        r="22"
        fill="none"
        stroke={RED}
        strokeWidth="14"
        strokeDasharray={dash}
        strokeDashoffset={offset}
        strokeLinecap="butt"
      />
    </svg>
  )
}

export function renderDailyLoopOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: PAPER,
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 14,
            background: RED,
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: RED,
            fontSize: 92,
            fontWeight: 700,
            letterSpacing: -1,
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          <span>The Daily L</span>
          <OpenO gap="top-left" />
          <OpenO gap="bottom-right" />
          <span>P</span>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 28,
            color: INK,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: 10,
            textTransform: 'uppercase',
          }}
        >
          — STAY IN IT —
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 48,
            color: '#666666',
            fontSize: 20,
            letterSpacing: 1,
          }}
        >
          The Build Report
        </div>
      </div>
    ),
    { ...DAILY_LOOP_OG_SIZE }
  )
}
