'use client'

import { useNormieMode } from '@/components/NormieModeProvider'
import YbIssueNav from '@/components/YbIssueNav'
import McpWire from '@/components/McpWire'
import DailyLoopWordmark from '@/components/DailyLoopWordmark'
import { canonicalYbIssuePath, ybIssueNumber } from '@/lib/ybIssue'
import {
  EXTERNAL_BRIEF_ACCOUNTS,
  EXTERNAL_BRIEF_MAX_COMMITS,
  EXTERNAL_BRIEFS_REFRESH_NOTE,
  EXTERNAL_BRIEFS_SUPER_DISCLAIMER,
  OUTSIDE_DESK_DECK,
  OUTSIDE_DESK_TAG,
  OUTSIDE_DESK_TITLE,
  externalBriefGithubLabel,
  externalBriefGithubUrl,
  type ExternalBriefAccount,
  type ExternalBriefAccountId,
  type ExternalBriefData,
} from '@/lib/externalOwnerBrief'
import type { McpWireSnapshot } from '@/lib/mcpWire'
import {
  legacyPublicLeadScore,
  orderStoriesForYbFrontPage,
} from '@/lib/yesterdaysBuildsLeadPolicy'

type Props = {
  briefs: Partial<Record<ExternalBriefAccountId, ExternalBriefData | null>>
  /** Admin regenerate controls */
  admin?: boolean
  loading?: Partial<Record<ExternalBriefAccountId, boolean>>
  running?: Partial<Record<ExternalBriefAccountId, boolean>>
  results?: Partial<Record<ExternalBriefAccountId, string | null>>
  onRegenerate?: (id: ExternalBriefAccountId) => void
  /** Public dated-issue nav. Omit on Admin. */
  issueDateKey?: string
  latestDateKey?: string
  /** Public MCP Wire desk. Omit on Admin — inbox lives separately. */
  mcpWire?: McpWireSnapshot | null
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/* ------------------------------------------------------------------
   FRONT-PAGE RANKING — YB-LEAD-v1 when leadPolicy exists on briefs.
   Falls back to legacy significance × commits × repos + ticker when an
   edition has no classifications yet (older cache / failed classify).
   ------------------------------------------------------------------ */
const COMMIT_CAP = 40
const NEUTRAL_SIGNIFICANCE = 3

function legacyFrontPageScore(story: Story): number {
  const brief = story.brief
  if (!brief) return 0
  return legacyPublicLeadScore({
    significance: brief.significance ?? NEUTRAL_SIGNIFICANCE,
    commitCount: Math.min(brief.commitCount ?? 0, COMMIT_CAP),
    repoCount: brief.repoCount ?? 0,
    ticker: story.account.ticker,
  })
}

function parseDateKey(dateKey: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d }
}

function formatDigestDate(dateKey: string): string {
  const p = parseDateKey(dateKey)
  if (!p) return dateKey
  return `${SHORT_MONTHS[p.m - 1]} ${p.d}, ${p.y}`
}

function formatLongDate(dateKey: string): string {
  const p = parseDateKey(dateKey)
  if (!p) return dateKey
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d))
  return `${WEEKDAYS[dt.getUTCDay()]}, ${LONG_MONTHS[p.m - 1]} ${p.d}, ${p.y}`
}

function outlookFlag(commits: number, projects: number): string {
  if (!projects) return 'Outlook: Presses Idle'
  if (commits === 0) return 'Outlook: Quiet'
  if (commits < 20) return 'Outlook: Steady'
  if (commits < 75) return 'Outlook: Shipping'
  return 'Outlook: Heavy Traffic'
}

function briefBody(brief: ExternalBriefData, normie: boolean): string {
  return (normie && brief.generalNormie) || brief.general || brief.text || ''
}

function briefHeadline(brief: ExternalBriefData | null, normie: boolean): string | null {
  if (!brief) return null
  const value = (normie && brief.headlineNormie) || brief.headline
  return value && value.trim() ? value.trim() : null
}

function briefDeck(brief: ExternalBriefData | null, normie: boolean): string | null {
  if (!brief) return null
  const value = (normie && brief.deckNormie) || brief.deck
  return value && value.trim() ? value.trim() : null
}

type Story = {
  account: ExternalBriefAccount
  brief: ExternalBriefData | null
  text: string
}

/** Long Also filed writeups must not sit in multi-column packs (empty neighbor shafts). */
const ALSO_FILED_LONG_CHARS = 700
const ALSO_FILED_LONG_PARAS = 2

function isLongAlsoFiled(story: Story): boolean {
  const text = story.text.trim()
  if (text.length > ALSO_FILED_LONG_CHARS) return true
  return toParagraphs(text).length > ALSO_FILED_LONG_PARAS
}

function toParagraphs(text: string): string[] {
  if (!text) return []
  return text.includes('\n\n')
    ? text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
    : [text.trim()]
}

/**
 * Fallback deck for editions cached before the model wrote one: lift the
 * first sentence, but only if it reads like a deck and leaves real body behind.
 */
function splitDeck(paragraphs: string[]): { deck: string | null; body: string[] } {
  if (!paragraphs.length) return { deck: null, body: [] }
  const first = paragraphs[0]
  const match = first.match(/^(.+?[.!?])(\s+)(.+)$/)
  if (match && match[1].length <= 150 && match[1].length >= 30) {
    const rest = match[3].trim()
    const body = rest ? [rest, ...paragraphs.slice(1)] : paragraphs.slice(1)
    if (body.length) return { deck: match[1], body }
  }
  if (paragraphs.length > 1 && first.length <= 150) {
    return { deck: first, body: paragraphs.slice(1) }
  }
  return { deck: null, body: paragraphs }
}

function commitLine(brief: ExternalBriefData | null): string | null {
  if (!brief || brief.commitCount <= 0) return null
  const c = `${brief.commitCount} commit${brief.commitCount === 1 ? '' : 's'}`
  if (brief.repoCount > 0) {
    return `${brief.repoCount} repo${brief.repoCount === 1 ? '' : 's'} · ${c}`
  }
  return c
}

function frontPageScore(story: Story): number {
  return legacyFrontPageScore(story)
}

type CommitPick = { quote: string; repo: string; label: string }

/**
 * One quote per edition, picked across every filed desk. Highest quoteScore
 * wins; front-page score breaks ties so the lead desk gets the nod.
 */
function pickCommitOfTheDay(stories: Story[]): CommitPick | null {
  let best: (CommitPick & { score: number; tie: number }) | null = null
  for (const story of stories) {
    const brief = story.brief
    if (!brief?.quote || !brief.quoteRepo) continue
    const score = brief.quoteScore ?? 1
    const tie = frontPageScore(story)
    if (!best || score > best.score || (score === best.score && tie > best.tie)) {
      best = {
        quote: brief.quote,
        repo: brief.quoteRepo,
        label: story.account.label,
        score,
        tie,
      }
    }
  }
  if (!best) return null
  return { quote: best.quote, repo: best.repo, label: best.label }
}

function CommitOfTheDay({ pick }: { pick: CommitPick }) {
  return (
    <aside className="ext-paper-cotd" aria-label="Commit of the day">
      <p className="ext-paper-sectionhead">Commit of the day</p>
      <blockquote className="ext-paper-cotd__quote">{pick.quote}</blockquote>
      <p className="ext-paper-cotd__attr">
        {pick.repo} · {pick.label}
      </p>
      <p className="ext-paper-cotd__note">
        Verbatim from a public commit message. Admin preview — not on the public page.
      </p>
    </aside>
  )
}

function RegenButton({
  running,
  loading,
  onRegenerate,
  small,
}: {
  running: boolean
  loading: boolean
  onRegenerate?: () => void
  small?: boolean
}) {
  if (!onRegenerate) return null
  return (
    <button
      type="button"
      className={small ? 'ext-paper-regen ext-paper-regen--sm' : 'ext-paper-regen'}
      onClick={onRegenerate}
      disabled={running || loading}
    >
      {running ? 'Setting…' : 'Regenerate'}
    </button>
  )
}

function Byline({
  account,
  brief,
  admin,
}: {
  account: ExternalBriefAccount
  brief: ExternalBriefData | null
  admin: boolean
}) {
  const commits = commitLine(brief)
  return (
    <p className="ext-paper-byline">
      <a href={externalBriefGithubUrl(account)} target="_blank" rel="noopener noreferrer">
        {externalBriefGithubLabel(account)}
      </a>
      {brief?.dateKey ? ` · ${formatDigestDate(brief.dateKey)}` : ''}
      {commits ? ` · ${commits}` : ''}
      {account.ticker ? ` · ${account.ticker}` : ''}
      {admin && brief?.significance ? ` · sig ${brief.significance}/5` : ''}
    </p>
  )
}

function StoryBlock({
  story,
  variant,
  admin,
  normie,
  loading,
  running,
  result,
  onRegenerate,
  leadKicker,
}: {
  story: Story
  variant: 'lead' | 'second' | 'brief'
  admin: boolean
  normie: boolean
  loading: boolean
  running: boolean
  result: string | null
  onRegenerate?: () => void
  /** Override the lead-slot label (e.g. Strongest observed when no material lead). */
  leadKicker?: string
}) {
  const { account, brief, text } = story
  const paragraphs = toParagraphs(text)

  const modelHeadline = briefHeadline(brief, normie)
  const modelDeck = briefDeck(brief, normie)

  // Only fall back to sentence-slicing on old editions that have no model deck.
  const useFallbackDeck = !modelDeck && variant !== 'brief'
  const sliced = useFallbackDeck ? splitDeck(paragraphs) : { deck: null, body: paragraphs }
  const deck = modelDeck ?? sliced.deck
  const body = sliced.body

  const label =
    variant === 'lead'
      ? leadKicker ?? 'Lead story'
      : variant === 'second'
        ? 'Report'
        : (brief?.commitCount ?? 0) <= 0
          ? 'Quiet'
          : 'In brief'

  return (
    <article id={account.id} className={`ext-paper-story ext-paper-story--${variant}`}>
      <div className="ext-paper-story__head">
        <div className="ext-paper-story__headwrap">
          <p className="ext-paper-kicker">
            {account.label}
            <span className="ext-paper-kicker__sep"> · </span>
            {label}
          </p>
          <h3 className="ext-paper-headline">{modelHeadline ?? account.label}</h3>
          {deck && <p className="ext-paper-deck">{deck}</p>}
          <Byline account={account} brief={brief} admin={admin} />
        </div>
        {admin && (
          <RegenButton
            running={running}
            loading={loading}
            onRegenerate={onRegenerate}
            small={variant === 'brief'}
          />
        )}
      </div>

      <div className="ext-paper-hairline" />

      {brief && brief.commitCount > EXTERNAL_BRIEF_MAX_COMMITS && (
        <p className="ext-paper-sample">
          Partial skim: {brief.commitCount} commits yesterday — writeup used the newest{' '}
          {EXTERNAL_BRIEF_MAX_COMMITS}.
        </p>
      )}
      {account.sampleNote && <p className="ext-paper-sample">{account.sampleNote}</p>}
      {admin && result && <p className="ext-paper-result">{result}</p>}

      <div className="ext-paper-body">
        {body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  )
}

export default function ExternalBriefsNewspaper({
  briefs,
  admin = false,
  loading = {},
  running = {},
  results = {},
  onRegenerate,
  issueDateKey,
  latestDateKey,
  mcpWire,
}: Props) {
  const { normie } = useNormieMode()

  const rows = EXTERNAL_BRIEF_ACCOUNTS.map(account => {
    const brief = briefs[account.id] ?? null
    return { account, brief, text: brief ? briefBody(brief, normie).trim() : '' } as Story
  })

  // Public: only desks that shipped (commits > 0).
  // Admin: keep quiet editions (0 commits, still have writeup text) after the
  // ranked shipping desks — orderStoriesForYbFrontPage drops commitCount === 0,
  // which used to make quiet desks vanish from both the paper and Off the wire.
  const withText = rows.filter(r => r.text.length > 0)
  const shipping = withText.filter(r => (r.brief?.commitCount ?? 0) > 0)
  const quiet = admin
    ? withText
        .filter(r => (r.brief?.commitCount ?? 0) <= 0)
        .sort((a, b) => a.account.label.localeCompare(b.account.label))
    : []

  const frontPage = orderStoriesForYbFrontPage(
    shipping.map(s => ({
      accountId: s.account.id,
      label: s.account.label,
      ticker: s.account.ticker,
      text: s.text,
      commitCount: s.brief?.commitCount ?? 0,
      repoCount: s.brief?.repoCount ?? 0,
      significance: s.brief?.significance,
      leadPolicy: s.brief?.leadPolicy,
    })),
  )

  const byId = new Map<string, Story>(shipping.map(s => [s.account.id, s]))
  const ranked = frontPage.orderedIds
    .map(id => byId.get(id))
    .filter((s): s is Story => Boolean(s))

  const filed = [...ranked, ...quiet]
  const wire = admin ? rows.filter(r => !r.text.length) : []
  const commitOfTheDay = admin ? pickCommitOfTheDay(ranked) : null

  const lead = ranked[0] ?? null
  const seconds = ranked.slice(1, 3)
  const shorts = [...ranked.slice(3), ...quiet]
  const longShorts = shorts.filter(s => isLongAlsoFiled(s))
  const packShorts = shorts.filter(s => !isLongAlsoFiled(s))
  const leadKicker =
    frontPage.usedV1 && !frontPage.materialLead ? 'Strongest observed' : 'Lead story'

  const anyDate = issueDateKey ?? rows.map(r => r.brief?.dateKey).find(Boolean) ?? null
  const issue = ybIssueNumber(anyDate)
  const totalCommits = ranked.reduce((sum, r) => sum + (r.brief?.commitCount ?? 0), 0)
  const totalRepos = ranked.reduce((sum, r) => sum + (r.brief?.repoCount ?? 0), 0)

  const stateFor = (id: ExternalBriefAccountId) => ({
    loading: Boolean(loading[id]),
    running: Boolean(running[id]),
    result: results[id] ?? null,
    onRegenerate: onRegenerate ? () => onRegenerate(id) : undefined,
  })

  return (
    <section className="ext-paper" aria-label={OUTSIDE_DESK_TITLE}>
      <div className="ext-paper-flag">
        <span className="ext-paper-flag__chip">{outlookFlag(totalCommits, ranked.length)}</span>
        <span className="ext-paper-flag__date">
          {anyDate ? (
            issueDateKey ? (
              <a href={canonicalYbIssuePath(issueDateKey)} className="ext-paper-flag__date-link">
                {formatLongDate(anyDate)}
              </a>
            ) : (
              formatLongDate(anyDate)
            )
          ) : (
            'Edition pending'
          )}
        </span>
        <span className="ext-paper-flag__issue">{issue ? `Issue No. ${issue}` : 'Issue —'}</span>
      </div>

      {issueDateKey && latestDateKey && (
        <YbIssueNav dateKey={issueDateKey} latestDateKey={latestDateKey} />
      )}

      <header className="ext-paper-masthead">
        <h2 className="ext-paper-masthead__title">
          <DailyLoopWordmark />
        </h2>
        <p className="ext-paper-masthead__tag">{OUTSIDE_DESK_TAG}</p>
        <p className="ext-paper-masthead__deck">
          {admin ? 'Admin desk · ' : ''}
          {OUTSIDE_DESK_DECK}
        </p>
        <p className="ext-paper-masthead__refresh">{EXTERNAL_BRIEFS_REFRESH_NOTE}</p>
      </header>

      <div className="ext-paper-rule ext-paper-rule--double" />

      <div className="ext-paper-ticker">
        {filed.length
          ? admin && quiet.length > 0
            ? `Overnight desk — ${ranked.length} shipped · ${quiet.length} quiet · ${totalRepos} repo${totalRepos === 1 ? '' : 's'} · ${totalCommits} commit${totalCommits === 1 ? '' : 's'}`
            : `Overnight desk — ${filed.length} project${filed.length === 1 ? '' : 's'} filed · ${totalRepos} repo${totalRepos === 1 ? '' : 's'} · ${totalCommits} commit${totalCommits === 1 ? '' : 's'}`
          : 'Overnight desk — no editions filed yet'}
      </div>

      {lead ? (
        <>
          <StoryBlock
            story={lead}
            variant="lead"
            admin={admin}
            normie={normie}
            leadKicker={leadKicker}
            {...stateFor(lead.account.id)}
          />

          {seconds.length > 0 && (
            <>
              <div className="ext-paper-rule" />
              <div className="ext-paper-secondrow">
                {seconds.map(story => (
                  <StoryBlock
                    key={story.account.id}
                    story={story}
                    variant="second"
                    admin={admin}
                    normie={normie}
                    {...stateFor(story.account.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : filed.length === 0 ? (
        <p className="ext-paper-empty">
          {admin
            ? 'No cached editions yet — hit Regenerate on a desk below or wait for the daily digest cron.'
            : 'No editions filed for this window yet — check back after the overnight refresh.'}
        </p>
      ) : null}

      {shorts.length > 0 && (
        <>
          <div className="ext-paper-rule" />
          <p className="ext-paper-sectionhead">{lead ? 'Also filed' : 'Quiet overnight'}</p>
          {longShorts.length > 0 && (
            <div className="ext-paper-shorts-long">
              {longShorts.map(story => (
                <StoryBlock
                  key={story.account.id}
                  story={story}
                  variant="brief"
                  admin={admin}
                  normie={normie}
                  {...stateFor(story.account.id)}
                />
              ))}
            </div>
          )}
          {packShorts.length > 0 && (
            <div
              className={
                packShorts.length === 1
                  ? 'ext-paper-shorts ext-paper-shorts--solo'
                  : 'ext-paper-shorts'
              }
            >
              {packShorts.map(story => (
                <StoryBlock
                  key={story.account.id}
                  story={story}
                  variant="brief"
                  admin={admin}
                  normie={normie}
                  {...stateFor(story.account.id)}
                />
              ))}
            </div>
          )}
          <div className="ext-paper-rule ext-paper-rule--double" aria-hidden="true" />
        </>
      )}

      {commitOfTheDay && (
        <>
          <div className="ext-paper-rule" />
          <CommitOfTheDay pick={commitOfTheDay} />
        </>
      )}

      {wire.length > 0 && (
        <>
          <div className="ext-paper-rule" />
          <p className="ext-paper-sectionhead">Off the wire</p>
          <ul className="ext-paper-wire">
            {wire.map(({ account }) => {
              const s = stateFor(account.id)
              return (
                <li key={account.id} id={account.id} className="ext-paper-wire__row">
                  <span className="ext-paper-wire__name">{account.label}</span>
                  <span className="ext-paper-wire__path">{externalBriefGithubLabel(account)}</span>
                  <span className="ext-paper-wire__note">
                    {s.loading ? 'Loading edition…' : 'No edition this window'}
                  </span>
                  {admin && (
                    <RegenButton running={s.running} loading={s.loading} onRegenerate={s.onRegenerate} small />
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {mcpWire !== undefined && (
        <>
          <div className="ext-paper-rule" />
          <McpWire wire={mcpWire} />
        </>
      )}

      <div className="ext-paper-banner">Scored and sourced daily · the-build-report.vercel.app</div>

      <p className="ext-paper-disclaimer">{EXTERNAL_BRIEFS_SUPER_DISCLAIMER}</p>
    </section>
  )
}
