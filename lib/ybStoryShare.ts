/**
 * Per-story Daily Loop share — short teaser + link to the edition.
 */
import {
  EXTERNAL_BRIEF_ACCOUNTS,
  getExternalBrief,
  getExternalBriefAccount,
  type ExternalBriefAccountId,
  type ExternalBriefData,
} from '@/lib/externalOwnerBrief'
import { TBR_SITE_URL, xIntentUrl, xWeightedLength, X_CHAR_LIMIT } from '@/lib/xSharePosts'
import { applyYbEditorialCopy, getYbEditorialOverride } from '@/lib/ybEditorialOverrides'
import { canonicalYbIssuePath, formatIssueLong, parseValidDateKey, ybIssueNumber } from '@/lib/ybIssue'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || TBR_SITE_URL

export type YbStorySharePayload = {
  dateKey: string
  accountId: ExternalBriefAccountId
  label: string
  headline: string
  /** 1–2 sentences for OG / landing / tweet body. */
  teaser: string
  /** Absolute URL that unfurls the share card. */
  shareUrl: string
  /** Full issue URL with story anchor. */
  issueUrl: string
  issueLabel: string
  commitCount: number
  repoCount: number
}

export function dailyLoopStorySharePath(dateKey: string, accountId: string): string {
  return `/daily-loop/s/${dateKey}/${accountId}`
}

export function dailyLoopStoryShareUrl(dateKey: string, accountId: string): string {
  return `${SITE}${dailyLoopStorySharePath(dateKey, accountId)}`
}

export function dailyLoopIssueStoryUrl(dateKey: string, accountId: string): string {
  return `${SITE}${canonicalYbIssuePath(dateKey)}#${accountId}`
}

/** First 1–2 sentences, capped for a share card. */
export function storyTeaserFromBrief(brief: ExternalBriefData, maxChars = 280): string {
  const deck = (brief.deck ?? '').trim()
  const body = (brief.general ?? '').replace(/\s+/g, ' ').trim()
  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)

  let teaser = ''
  if (deck) {
    teaser = deck.replace(/\.$/, '') + '.'
    if (sentences[0] && !sentences[0].toLowerCase().startsWith(deck.slice(0, 24).toLowerCase())) {
      teaser = `${teaser} ${sentences[0]}`
    }
  } else {
    teaser = sentences.slice(0, 2).join(' ')
  }

  teaser = teaser.replace(/\s+/g, ' ').trim()
  if (teaser.length <= maxChars) return teaser
  const cut = teaser.slice(0, maxChars - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

export async function loadYbStorySharePayload(
  dateKeyRaw: string,
  accountIdRaw: string,
): Promise<YbStorySharePayload | null> {
  const dateKey = parseValidDateKey(dateKeyRaw)
  if (!dateKey) return null
  const account = getExternalBriefAccount(accountIdRaw)
  if (!account) return null

  let brief = await getExternalBrief(account.id, dateKey)
  if (!brief) return null

  const editorial = getYbEditorialOverride(dateKey)
  if (editorial && editorial.leadAccountId === account.id && brief.dateKey === editorial.dateKey) {
    brief = applyYbEditorialCopy(brief, editorial)
  }

  const headline = (brief.headline ?? account.label).trim()
  const teaser = storyTeaserFromBrief(brief)
  const issueNo = ybIssueNumber(dateKey)
  const issueLabel = issueNo
    ? `The Daily Loop · Issue No. ${issueNo} · ${formatIssueLong(dateKey)}`
    : `The Daily Loop · ${formatIssueLong(dateKey)}`

  return {
    dateKey,
    accountId: account.id,
    label: account.label,
    headline,
    teaser,
    shareUrl: dailyLoopStoryShareUrl(dateKey, account.id),
    issueUrl: dailyLoopIssueStoryUrl(dateKey, account.id),
    issueLabel,
    commitCount: brief.commitCount ?? 0,
    repoCount: brief.repoCount ?? 0,
  }
}

export function composeYbStoryTweet(payload: YbStorySharePayload): string {
  const url = payload.shareUrl
  const header = payload.headline.toUpperCase() === payload.headline
    ? payload.headline
    : payload.headline
  let body = `${header}\n\n${payload.teaser}\n\nRead more → ${url}`

  // Trim teaser until tweet fits X free limit (URL weighted).
  if (xWeightedLength(body) <= X_CHAR_LIMIT) return body

  let teaser = payload.teaser
  while (teaser.length > 40) {
    const cut = teaser.slice(0, Math.floor(teaser.length * 0.85))
    const lastSpace = cut.lastIndexOf(' ')
    teaser = `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`
    body = `${header}\n\n${teaser}\n\nRead more → ${url}`
    if (xWeightedLength(body) <= X_CHAR_LIMIT) return body
  }

  return `${header}\n\nRead more → ${url}`
}

export function ybStoryXIntentUrl(payload: YbStorySharePayload): string {
  return xIntentUrl(composeYbStoryTweet(payload))
}

export function isKnownDailyLoopAccountId(id: string): id is ExternalBriefAccountId {
  return EXTERNAL_BRIEF_ACCOUNTS.some(a => a.id === id)
}
