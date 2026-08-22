import {
  DAILY_LOOP_OG_ALT,
  DAILY_LOOP_OG_CONTENT_TYPE,
  DAILY_LOOP_OG_SIZE,
  renderDailyLoopOgImage,
} from '@/lib/ogDailyLoop'

export const runtime = 'edge'
export const alt = DAILY_LOOP_OG_ALT
export const size = DAILY_LOOP_OG_SIZE
export const contentType = DAILY_LOOP_OG_CONTENT_TYPE

export default function Image() {
  return renderDailyLoopOgImage()
}
