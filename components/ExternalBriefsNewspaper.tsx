'use client'

import { useNormieMode } from '@/components/NormieModeProvider'
import YbIssueNav from '@/components/YbIssueNav'
import { canonicalYbIssuePath } from '@/lib/ybIssue'
import {
  EXTERNAL_BRIEF_ACCOUNTS,
  EXTERNAL_BRIEF_MAX_COMMITS,
  EXTERNAL_BRIEFS_REFRESH_NOTE,
  EXTERNAL_BRIEFS_SUPER_DISCLAIMER,
  externalBriefGithubLabel,
  externalBriefGithubUrl,
  type ExternalBriefAccount,
  type ExternalBriefAccountId,
  type ExternalBriefData,
} from '@/lib/externalOwnerBrief'

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
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Issue numbering epoch — day 1 of the paper. Bump only if you want to re-baseline. */
const ISSUE_EPOCH = Date.UTC(2025, 11, 31)

/* ------------------------------------------------------------------
   FRONT-PAGE RANKING — how a story gets pegged as the lead.

   score = significance × 100
         + min(commits, COMMIT_CAP)
         + repos × 2
         + (has a token ticker ? TICKER_EDGE : 0)

   significance (1-5) is the model's read of how much the day actually
   mattered for that account, judged on what the commits DID, not how
   many there were. It dominates on purpose: 40 dependency bumps is a 1,
   one real feature merge is a 4.

   Commits are capped so a bot-spam day can't buy the front page — they
   only break ties between stories of equal significance.

   TICKER_EDGE is a thumb on the scale for accounts with a token, since
   holders are who this page is for. Set it to 0 for a neutral desk.

   Editions cached before significance existed default to NEUTRAL.

   Public ranking lives HERE, not in yesterdaysBuildsLeadPolicy.
   Do not import YB-LEAD-v1 for story order. Shadow comparison is Admin-only.
   ------------------------------------------------------------------ */
const COMMIT_CAP = 40
const TICKER_EDGE = 15
const NEUTRAL_SIGNIFICANCE = 3

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

function issueNumber(dateKey: string | null): number | null {
  if (!dateKey) return null
  const p = parseDateKey(dateKey)
  if (!p) return null
  const days = Math.round((Date.UTC(p.y, p.m - 1, p.d) - ISSUE_EPOCH) / 86400000)
  return days > 0 ? days : null
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

type Story = {
  account: ExternalBriefAccount
  brief: ExternalBriefData | null
  text: string
}

function frontPageScore(story: Story): number {
  const brief = story.brief
  if (!brief) return 0
  const significance = brief.significance ?? NEUTRAL_SIGNIFICANCE
  const commits = Math.min(brief.commitCount ?? 0, COMMIT_CAP)
  const repos = brief.repoCount ?? 0
  return significance * 100 + commits + repos * 2 + (story.account.ticker ? TICKER_EDGE : 0)
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
}: {
  story: Story
  variant: 'lead' | 'second' | 'brief'
  admin: boolean
  normie: boolean
  loading: boolean
  running: boolean
  result: string | null
  onRegenerate?: () => void
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

  const label = variant === 'lead' ? 'Lead story' : variant === 'second' ? 'Report' : 'In brief'

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
}: Props) {
  const { normie } = useNormieMode()

  const rows = EXTERNAL_BRIEF_ACCOUNTS.map(account => {
    const brief = briefs[account.id] ?? null
    return { account, brief, text: brief ? briefBody(brief, normie).trim() : '' } as Story
  })

  // Public paper: only projects that actually shipped yesterday. Quiet/blank
  // desks stay visible in Admin so you can regenerate and inspect them.
  const filed = rows
    .filter(r => r.text.length > 0)
    .filter(r => admin || (r.brief?.commitCount ?? 0) > 0)
    .sort((a, b) => {
      const diff = frontPageScore(b) - frontPageScore(a)
      if (diff !== 0) return diff
      return (b.brief?.commitCount ?? 0) - (a.brief?.commitCount ?? 0)
    })

  const wire = admin ? rows.filter(r => !r.text.length) : []
  const commitOfTheDay = admin ? pickCommitOfTheDay(filed) : null

  const lead = filed[0] ?? null
  const seconds = filed.slice(1, 3)
  const shorts = filed.slice(3)

  const anyDate = issueDateKey ?? rows.map(r => r.brief?.dateKey).find(Boolean) ?? null
  const issue = issueNumber(anyDate)
  const totalCommits = filed.reduce((sum, r) => sum + (r.brief?.commitCount ?? 0), 0)
  const totalRepos = filed.reduce((sum, r) => sum + (r.brief?.repoCount ?? 0), 0)

  const stateFor = (id: ExternalBriefAccountId) => ({
    loading: Boolean(loading[id]),
    running: Boolean(running[id]),
    result: results[id] ?? null,
    onRegenerate: onRegenerate ? () => onRegenerate(id) : undefined,
  })

  return (
    <section className="ext-paper" aria-label="Yesterday's Builds">
      <div className="ext-paper-flag">
        <span className="ext-paper-flag__chip">{outlookFlag(totalCommits, filed.length)}</span>
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
        <h2 className="ext-paper-masthead__title">Yesterday&apos;s Builds</h2>
        <p className="ext-paper-masthead__deck">
          {admin ? 'Admin desk · ' : ''}Free · Independent community project
        </p>
        <p className="ext-paper-masthead__refresh">{EXTERNAL_BRIEFS_REFRESH_NOTE}</p>
      </header>

      <div className="ext-paper-rule ext-paper-rule--double" />

      <div className="ext-paper-ticker">
        {filed.length
          ? `Overnight desk — ${filed.length} project${filed.length === 1 ? '' : 's'} filed · ${totalRepos} repo${totalRepos === 1 ? '' : 's'} · ${totalCommits} commit${totalCommits === 1 ? '' : 's'}`
          : 'Overnight desk — no editions filed yet'}
      </div>

      {lead ? (
        <>
          <StoryBlock
            story={lead}
            variant="lead"
            admin={admin}
            normie={normie}
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

          {shorts.length > 0 && (
            <>
              <div className="ext-paper-rule" />
              <p className="ext-paper-sectionhead">Also filed</p>
              <div className="ext-paper-shorts">
                {shorts.map(story => (
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
            </>
          )}
        </>
      ) : (
        <p className="ext-paper-empty">
          {admin
            ? 'No cached editions yet — hit Regenerate on a desk below or wait for the daily digest cron.'
            : 'No editions filed for this window yet — check back after the overnight refresh.'}
        </p>
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

      <div className="ext-paper-banner">Scored and sourced daily · the-build-report.vercel.app</div>

      <p className="ext-paper-disclaimer">{EXTERNAL_BRIEFS_SUPER_DISCLAIMER}</p>
    </section>
  )
}
