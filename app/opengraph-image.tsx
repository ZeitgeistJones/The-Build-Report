import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'The Build Report — a plain English look at the repos, scored and sourced.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ACCENT = '#3D9A88'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0E1414 0%, #16201E 100%)',
          padding: '72px',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '96px',
              height: '96px',
              borderRadius: '20px',
              background: ACCENT,
              color: '#FFFFFF',
              fontSize: '40px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            TBR
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '26px',
              color: ACCENT,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Independent Community Project
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div
            style={{
              display: 'flex',
              fontSize: '104px',
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.02,
              letterSpacing: '-0.03em',
            }}
          >
            The Build Report
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '38px',
              color: '#C7D2CE',
              lineHeight: 1.3,
              maxWidth: '900px',
            }}
          >
            A plain English look at the repos, scored and sourced.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            fontSize: '28px',
            color: '#8FA39D',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '0.04em',
          }}
        >
          <div style={{ display: 'flex' }}>Independent</div>
          <div style={{ display: 'flex', color: ACCENT }}>·</div>
          <div style={{ display: 'flex' }}>Scored</div>
          <div style={{ display: 'flex', color: ACCENT }}>·</div>
          <div style={{ display: 'flex' }}>Sourced</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
