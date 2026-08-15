'use client'

import { useNormieMode } from '@/components/NormieModeProvider'
import {
  EXTERNAL_BRIEF_ACCOUNTS,
  EXTERNAL_BRIEFS_SUPER_DISCLAIMER,
  EXTERNAL_BRIEFS_COVERAGE_NOTE,
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

function formatDigestDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d || m < 1 || m > 12) return dateKey
  return `${SHORT_MONTHS[m - 1]} ${d}, ${y}`
}

function briefBody(brief: BuildBriefData, normie: boolean): string {
  return (normie && brief.generalNormie) || brief.general || brief.text || ''
}

function Article({
  account,
  brief,
  admin,
  loading,
  running,
  result,
  onRegenerate,
  normie,
}: {
  account: ExternalBriefAccount
  brief: BuildBriefData | null
  admin: boolean
  loading: boolean
  running: boolean
  result: string | null
  onRegenerate?: () => void
  normie: boolean
}) {
  const text = brief ? briefBody(brief, normie) : ''
  const paragraphs = text
    ? text.includes('\n\n')
      ? text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
      : [text]
    : []

  return (
    <article id={account.id} className="ext-paper-article">
      <header className="ext-paper-article__head">
        <div>
          <p className="ext-paper-kicker">Yesterday&apos;s build</p>
          <h3 className="ext-paper-headline">{account.label}</h3>
          <p className="ext-paper-byline">
            <a href={externalBriefGithubUrl(account)} target="_blank" rel="noopener noreferrer">
              {externalBriefGithubLabel(account)}
            </a>
            {brief?.dateKey ? ` · ${formatDigestDate(brief.dateKey)}` : ''}
            {brief && brief.commitCount > 0
              ? ` · ${brief.commitCount} commit${brief.commitCount === 1 ? '' : 's'}`
              : ''}
            {account.ticker ? ` · ${account.ticker}` : ''}
          </p>
        </div>
        {admin && onRegenerate && (
          <button
            type="button"
            className="ext-paper-regen"
            onClick={onRegenerate}
            disabled={running || loading}
          >
            {running ? 'Generating…' : 'Regenerate'}
          </button>
        )}
      </header>

      {admin && result && <p className="ext-paper-result">{result}</p>}

      {loading && !brief ? (
        <p className="ext-paper-empty">Loading edition…</p>
      ) : paragraphs.length ? (
        <div className="ext-paper-body">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <p className="ext-paper-empty">
          {admin
            ? 'No cached edition yet — hit Regenerate or wait for the daily digest cron.'
            : 'No edition yet for this window — check back after the overnight refresh.'}
        </p>
      )}
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
  const anyDate =
    EXTERNAL_BRIEF_ACCOUNTS.map(a => briefs[a.id]?.dateKey).find(Boolean) ?? null

  return (
    <section className="ext-paper" aria-label="Yesterday's Builds">
      <header className="ext-paper-masthead">
        <p className="ext-paper-masthead__eyebrow">
          {admin ? 'The Build Report · Admin desk' : 'The Build Report'}
        </p>
        <h2 className="ext-paper-masthead__title">Yesterday&apos;s Builds</h2>
        <div className="ext-paper-masthead__rule" />
        <p className="ext-paper-masthead__deck">
          Overnight shipping digests for builders and projects we track outside the main clawdbotatg
          report.
          {anyDate ? ` Edition window: ${formatDigestDate(anyDate)} (Mountain).` : ''}
        </p>
        <p className="ext-paper-disclaimer">{EXTERNAL_BRIEFS_SUPER_DISCLAIMER}</p>
        <p className="ext-paper-coverage">{EXTERNAL_BRIEFS_COVERAGE_NOTE}</p>
      </header>

      <div className="ext-paper-grid">
        {EXTERNAL_BRIEF_ACCOUNTS.map(account => (
          <Article
            key={account.id}
            account={account}
            brief={briefs[account.id] ?? null}
            admin={admin}
            loading={Boolean(loading[account.id])}
            running={Boolean(running[account.id])}
            result={results[account.id] ?? null}
            onRegenerate={onRegenerate ? () => onRegenerate(account.id) : undefined}
            normie={normie}
          />
        ))}
      </div>
    </section>
  )
}
