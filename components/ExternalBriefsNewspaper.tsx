'use client'

import { useNormieMode } from '@/components/NormieModeProvider'
import {
  EXTERNAL_BRIEF_ACCOUNTS,
  EXTERNAL_BRIEFS_SUPER_DISCLAIMER,
  externalBriefGithubLabel,
  externalBriefGithubUrl,
  type ExternalBriefAccount,
  type ExternalBriefAccountId,
} from '@/lib/externalOwnerBrief'
import type { BuildBriefData } from '@/lib/buildBrief'

type Props = {
  briefs: Partial<Record<ExternalBriefAccountId, BuildBriefData | null>>
  /** Admin regenerate controls */
  admin?: boolean
  loading?: Partial<Record<ExternalBriefAccountId, boolean>>
  running?: Partial<Record<ExternalBriefAccountId, boolean>>
  results?: Partial<Record<ExternalBriefAccountId, string | null>>
  onRegenerate?: (id: ExternalBriefAccountId) => void
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Issue numbering epoch — day 1 of the paper. Bump only if you want to re-baseline. */
const ISSUE_EPOCH = Date.UTC(2025, 11, 31)

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

function briefBody(brief: BuildBriefData, normie: boolean): string {
  return (normie && brief.generalNormie) || brief.general || brief.text || ''
}

function toParagraphs(text: string): string[] {
  if (!text) return []
  return text.includes('\n\n')
    ? text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
    : [text.trim()]
}

/**
 * Newspapers put a one-line deck under the headline. We don't have an LLM-written
 * deck, so we lift the first sentence — but only if it reads like a deck (short
 * enough) and there's real body left behind it.
 */
function splitDeck(paragraphs: string[]): { deck: string | null; body: string[] } {
  if (!paragraphs.length) return { deck: null, body: [] }
  const first = paragraphs[0]
  const match = first.match(/^(.+?[.!?])(\s+)([\s\S]+)$/)
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

function commitLine(brief: BuildBriefData | null): string | null {
  if (!brief || brief.commitCount <= 0) return null
  const c = `${brief.commitCount} commit${brief.commitCount === 1 ? '' : 's'}`
  if (brief.repoCount > 0) {
    return `${brief.repoCount} repo${brief.repoCount === 1 ? '' : 's'} · ${c}`
  }
  return c
}

type Story = {
  account: ExternalBriefAccount
  brief: BuildBriefData | null
  text: string
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

function Byline({ account, brief }: { account: ExternalBriefAccount; brief: BuildBriefData | null }) {
  const commits = commitLine(brief)
  return (
    <p className="ext-paper-byline">
      <a href={externalBriefGithubUrl(account)} target="_blank" rel="noopener noreferrer">
        {externalBriefGithubLabel(account)}
      </a>
      {brief?.dateKey ? ` · ${formatDigestDate(brief.dateKey)}` : ''}
      {commits ? ` · ${commits}` : ''}
      {account.ticker ? ` · ${account.ticker}` : ''}
    </p>
  )
}

function Story({
  story,
  variant,
  admin,
  loading,
  running,
  result,
  onRegenerate,
}: {
  story: Story
  variant: 'lead' | 'second' | 'brief'
  admin: boolean
  loading: boolean
  running: boolean
  result: string | null
  onRegenerate?: () => void
}) {
  const { account, brief, text } = story
  const paragraphs = toParagraphs(text)
  const { deck, body } = variant === 'brief' ? { deck: null, body: paragraphs } : splitDeck(paragraphs)

  return (
    <article id={account.id} className={`ext-paper-story ext-paper-story--${variant}`}>
      <div className="ext-paper-story__head">
        <div className="ext-paper-story__headwrap">
          <p className="ext-paper-kicker">
            {variant === 'lead' ? 'Lead story' : variant === 'second' ? 'Report' : 'In brief'}
            {account.ticker ? ` · ${account.ticker}` : ''}
          </p>
          <h3 className="ext-paper-headline">{account.label}</h3>
          {deck && <p className="ext-paper-deck">{deck}</p>}
          <Byline account={account} brief={brief} />
        </div>
        {admin && (
          <RegenButton running={running} loading={loading} onRegenerate={onRegenerate} small={variant === 'brief'} />
        )}
      </div>

      <div className="ext-paper-hairline" />

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
}: Props) {
  const { normie } = useNormieMode()

  const rows = EXTERNAL_BRIEF_ACCOUNTS.map(account => {
    const brief = briefs[account.id] ?? null
    return { account, brief, text: brief ? briefBody(brief, normie).trim() : '' } as Story
  })

  const filed = rows
    .filter(r => r.text.length > 0)
    .sort((a, b) => {
      const ac = a.brief?.commitCount ?? 0
      const bc = b.brief?.commitCount ?? 0
      if (bc !== ac) return bc - ac
      const ar = a.brief?.repoCount ?? 0
      const br = b.brief?.repoCount ?? 0
      return br - ar
    })

  const wire = rows.filter(r => !r.text.length)

  const lead = filed[0] ?? null
  const seconds = filed.slice(1, 3)
  const shorts = filed.slice(3)

  const anyDate = rows.map(r => r.brief?.dateKey).find(Boolean) ?? null
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
        <span className="ext-paper-flag__date">{anyDate ? formatLongDate(anyDate) : 'Edition pending'}</span>
        <span className="ext-paper-flag__issue">{issue ? `Issue No. ${issue}` : 'Issue —'}</span>
      </div>

      <header className="ext-paper-masthead">
        <h2 className="ext-paper-masthead__title">Yesterday&apos;s Builds</h2>
        <p className="ext-paper-masthead__deck">
          {admin ? 'Admin desk · ' : ''}Free · Independent community project
        </p>
      </header>

      <div className="ext-paper-rule ext-paper-rule--double" />

      <div className="ext-paper-ticker">
        {filed.length
          ? `Overnight desk — ${filed.length} project${filed.length === 1 ? '' : 's'} filed · ${totalRepos} repo${totalRepos === 1 ? '' : 's'} · ${totalCommits} commit${totalCommits === 1 ? '' : 's'}`
          : 'Overnight desk — no editions filed yet'}
      </div>

      {lead ? (
        <>
          <Story story={lead} variant="lead" admin={admin} {...stateFor(lead.account.id)} />

          {seconds.length > 0 && (
            <>
              <div className="ext-paper-rule" />
              <div className="ext-paper-secondrow">
                {seconds.map(story => (
                  <Story
                    key={story.account.id}
                    story={story}
                    variant="second"
                    admin={admin}
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
                  <Story
                    key={story.account.id}
                    story={story}
                    variant="brief"
                    admin={admin}
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
