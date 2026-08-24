import { ImageResponse } from 'next/og'

export const DAILY_LOOP_STORY_OG_SIZE = { width: 1200, height: 630 }
export const DAILY_LOOP_STORY_OG_CONTENT_TYPE = 'image/png'

const PAPER = '#FAFAFA'
const RED = '#8B2323'
const INK = '#111111'
const MUTED = '#5C5C5C'

export type DailyLoopStoryOgInput = {
  label: string
  headline: string
  teaser: string
  issueLabel: string
}

function clampLines(text: string, maxChars: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= maxChars) return t
  const cut = t.slice(0, maxChars - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

export function renderDailyLoopStoryOgImage(input: DailyLoopStoryOgInput) {
  const headline = clampLines(input.headline, 72)
  const teaser = clampLines(input.teaser, 220)
  const kicker = input.label.toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: PAPER,
          fontFamily: 'Georgia, "Times New Roman", serif',
          padding: '48px 56px 40px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 12,
            background: RED,
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              color: RED,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: 'uppercase',
              fontFamily: 'Helvetica, Arial, sans-serif',
            }}
          >
            The Daily Loop
          </div>
          <div
            style={{
              display: 'flex',
              color: MUTED,
              fontSize: 18,
              fontFamily: 'Helvetica, Arial, sans-serif',
              letterSpacing: 1,
            }}
          >
            The Build Report
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            color: RED,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: 'uppercase',
            fontFamily: 'Helvetica, Arial, sans-serif',
            marginBottom: 16,
          }}
        >
          {kicker}
          <span style={{ margin: '0 10px', color: '#CCCCCC' }}>·</span>
          STORY
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: headline.length > 42 ? 48 : 56,
            fontWeight: 700,
            lineHeight: 1.12,
            color: INK,
            letterSpacing: -1,
            textTransform: 'uppercase',
            fontFamily: 'Helvetica, Arial, sans-serif',
            maxWidth: 1080,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 22,
            width: 72,
            height: 3,
            background: RED,
          }}
        />

        <div
          style={{
            display: 'flex',
            marginTop: 22,
            fontSize: 28,
            lineHeight: 1.45,
            color: '#2A2A2A',
            maxWidth: 1000,
            fontStyle: 'italic',
          }}
        >
          {teaser}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            paddingTop: 28,
            borderTop: '1px solid #DDDDDD',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              color: MUTED,
              fontSize: 18,
              fontFamily: 'Helvetica, Arial, sans-serif',
            }}
          >
            {input.issueLabel}
          </div>
          <div
            style={{
              display: 'flex',
              color: RED,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              fontFamily: 'Helvetica, Arial, sans-serif',
            }}
          >
            Read more →
          </div>
        </div>
      </div>
    ),
    { ...DAILY_LOOP_STORY_OG_SIZE },
  )
}
