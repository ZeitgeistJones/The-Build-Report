import { ImageResponse } from 'next/og'

export const OG_ALT =
  'The Build Report — a plain English look at the repos, scored and sourced'
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const ACCENT = '#2F9E8B'
const INK = '#111827'

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          position: 'relative',
          background:
            'linear-gradient(135deg, #FFFFFF 0%, #F4F7F6 55%, #E9F1EE 100%)',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* Left accent rail */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 14,
            height: 630,
            background: ACCENT,
          }}
        />

        {/* Oversized watermark mark, bleeds off the right edge */}
        <div
          style={{
            position: 'absolute',
            top: 120,
            right: -140,
            width: 560,
            height: 560,
            borderRadius: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${ACCENT} 0%, #217A6B 100%)`,
            opacity: 0.1,
            transform: 'rotate(-12deg)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 90px',
            maxWidth: 900,
          }}
        >
          {/* Brand row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 40,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${ACCENT} 0%, #217A6B 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 1,
                fontFamily: 'Helvetica, Arial, sans-serif',
                boxShadow: '0 10px 30px rgba(47,158,139,0.35)',
              }}
            >
              TBR
            </div>
            <div
              style={{
                marginLeft: 22,
                fontSize: 20,
                letterSpacing: 5,
                color: '#6B7280',
                textTransform: 'uppercase',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontWeight: 600,
              }}
            >
              Independent Community Project
            </div>
          </div>

          {/* Headline */}
          <div
            style={{
              display: 'flex',
              fontSize: 108,
              lineHeight: 1.02,
              fontWeight: 700,
              color: INK,
              letterSpacing: -2,
            }}
          >
            The Build Report
          </div>

          {/* Tagline */}
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 34,
              lineHeight: 1.3,
              color: '#374151',
              maxWidth: 720,
            }}
          >
            A plain English look at the repos, scored and sourced.
          </div>

          {/* Footer tags */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 56,
              fontSize: 24,
              letterSpacing: 1,
              color: ACCENT,
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontWeight: 600,
            }}
          >
            Independent
            <span style={{ margin: '0 16px', color: '#9CA3AF' }}>·</span>
            Scored
            <span style={{ margin: '0 16px', color: '#9CA3AF' }}>·</span>
            Sourced
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  )
}
