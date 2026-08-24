import {
  DAILY_LOOP_STORY_OG_CONTENT_TYPE,
  DAILY_LOOP_STORY_OG_SIZE,
  renderDailyLoopStoryOgImage,
} from '@/lib/ogDailyLoopStory'
import { loadYbStorySharePayload } from '@/lib/ybStoryShare'

export const runtime = 'nodejs'
export const alt = 'The Daily Loop story'
export const size = DAILY_LOOP_STORY_OG_SIZE
export const contentType = DAILY_LOOP_STORY_OG_CONTENT_TYPE

export default async function Image({
  params,
}: {
  params: { dateKey: string; accountId: string }
}) {
  const payload = await loadYbStorySharePayload(params.dateKey, params.accountId)
  if (!payload) {
    return renderDailyLoopStoryOgImage({
      label: 'Daily Loop',
      headline: 'Story not found',
      teaser: 'This edition or desk is missing from the archive.',
      issueLabel: 'The Daily Loop · The Build Report',
    })
  }
  return renderDailyLoopStoryOgImage({
    label: payload.label,
    headline: payload.headline,
    teaser: payload.teaser,
    issueLabel: payload.issueLabel,
  })
}
