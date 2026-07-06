'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BuilderGrade, TokenMechanicGrade, IntegrityGrade, formatTrendDelta, TrendExplanation, Period } from '@/lib/grades'
import type { GradeNewArrival } from '@/lib/gradeNewArrivals'
import { timeAgo } from '@/lib/github'
import { gradeColor } from '@/lib/gradeLetters'
import { rubricBlockById } from '@/lib/rubricReference'
import { PeriodToggle, useGradePeriod } from './GradePeriodContext'
import { integrityGradeFootnote } from '@/lib/cardFraming'
import type { DailyDigestCards } from '@/lib/buildBrief'
import type { Repo } from '@/lib/scores'
import type { GitHubStats } from '@/lib/github'
import {
  builderCardLayman,
  economicCardLayman,
  integrityCardLayman,
  digestMissingPeriodCards,
  type GradeCardId,
} from '@/lib/gradeCardCopy'
import { useIsMobile } from '@/hooks/useIsMobile'
import RubricBlockPanel from '@/components/RubricBlockPanel'

type CardId = GradeCardId

interface Props {
  builderGrade24: BuilderGrade | null
  builderGrade30: BuilderGrade | null
  builderGrade7: BuilderGrade | null
  builderGrade60: BuilderGrade | null
  tokenMechanicGrade24: TokenMechanicGrade | null
  tokenMechanicGrade30: TokenMechanicGrade | null
  tokenMechanicGrade7: TokenMechanicGrade | null
  tokenMechanicGrade60: TokenMechanicGrade | null
  integrityGrade24: IntegrityGrade | null
  integrityGrade30: IntegrityGrade | null
  integrityGrade7: IntegrityGrade | null
  integrityGrade60: IntegrityGrade | null
  stats24h: { commits: number; activeDays: number; newRepos: number } | null
  stats30d: { commits: number; activeDays: number; newRepos: number } | null
  stats7d: { commits: number; activeDays: number; newRepos: number } | null
  stats60d: { commits: number; activeDays: number; newRepos: number } | null
  digestCards: DailyDigestCards | null
  githubStats?: GitHubStats | null
  repos?: Repo[]
  communityContextEnabled?: boolean
}

const CARD_LABELS: Record<CardId, string> = {
  builder: 'Builder activity',
  economic: 'Holder economics',
  integrity: 'Builder standards',
}

const CARD_RUBRIC_ID: Record<CardId, string> = {
  builder: 'builder-activity',
  economic: 'token-mechanic',
  integrity: 'builder-integrity',
}

function TrendArrow({ trend }: { trend: 'up' | 'flat' | 'down' | 'new' }) {
  if (trend === 'up') return <span style={{ color: 'var(--green)', fontSize: '12px' }}>↑</span>
  if (trend === 'down') return <span style={{ color: 'var(--red)', fontSize: '12px' }}>↓</span>
  if (trend === 'new') return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>•</span>
  return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
}

function RubricBreakdownTray({
  cardId,
  statsNode,
  extraBelowStats,
  onClose,
  isMobile,
}: {
  cardId: CardId
  statsNode?: React.ReactNode
  extraBelowStats?: React.ReactNode
  onClose: () => void
  isMobile: boolean
}) {
  const block = rubricBlockById(CARD_RUBRIC_ID[cardId])
  if (!block) return null

  return (
    <div
      style={{
        marginTop: '12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-lg)',
        padding: isMobile ? '14px 16px' : '20px 24px',
        animation: 'fadeTray 0.15s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          gap: '12px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}
        >
          Grade breakdown — {CARD_LABELS[cardId]}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>
      {statsNode && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 14px',
            marginBottom: extraBelowStats ? '10px' : '14px',
            paddingBottom: extraBelowStats ? '10px' : '14px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {statsNode}
        </div>
      )}
      {extraBelowStats && (
        <div
          style={{
            marginBottom: '14px',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          {extraBelowStats}
        </div>
      )}
      <RubricBlockPanel block={block} defaultOpen compact />
      <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
        <Link href={`/how-we-score#hw-rubric-${block.id}`} style={{ color: 'var(--accent)' }}>
          Full methodology →
        </Link>
      </p>
    </div>
  )
}

type ArrivalsCardId = 'economic' | 'integrity'

function NewArrivalsTray({
  cardId,
  arrivals,
  onClose,
  isMobile,
}: {
  cardId: ArrivalsCardId
  arrivals: GradeNewArrival[]
  onClose: () => void
  isMobile: boolean
}) {
  const label = cardId === 'economic' ? 'Holder economics' : 'Builder standards'

  return (
    <div
      style={{
        marginTop: '12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-lg)',
        padding: isMobile ? '14px 16px' : '20px 24px',
        animation: 'fadeTray 0.15s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}
        >
          New arrivals — {label}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        First time in this grade&apos;s sample — shown once per project, even if you change the period toggle.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {arrivals.map(a => (
          <li
            key={a.slug}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 12px',
              alignItems: 'baseline',
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</span>
            {a.kind === 'category_entry' && (
              <span
                style={{ color: 'var(--text-muted)', fontSize: '11px' }}
                title="Already active elsewhere — newly counted in this grade's sample."
              >
                · existing project
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
              {a.firstCommitAt ? `first commit ${timeAgo(a.firstCommitAt)}` : 'first commit —'}
              {' · '}
              {a.commits} commit{a.commits === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TrendDetailTray({
  cardId,
  explanation,
  onClose,
  isMobile,
}: {
  cardId: CardId
  explanation: TrendExplanation
  onClose: () => void
  isMobile: boolean
}) {
  return (
    <div
      style={{
        marginTop: '12px',
        background: 'var(--surface-2)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-lg)',
        padding: isMobile ? '14px 16px' : '20px 24px',
        animation: 'fadeTray 0.15s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}
        >
          Why this trend? — {CARD_LABELS[cardId]}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>
      <p style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.55 }}>
        {explanation.headline}
      </p>
      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {explanation.bullets.map(b => (
          <li key={b} style={{ marginBottom: '4px' }}>{b}</li>
        ))}
      </ul>
    </div>
  )
}

function GradeCard({
  cardId,
  grade,
  label,
  laymanCopy,
  period,
  trendExplanation,
  isSelected,
  onSelectTrend,
  isRubricSelected,
  onSelectRubric,
  newArrivalsCount = 0,
  isArrivalsSelected = false,
  onSelectArrivals,
  isMobile,
}: {
  cardId: CardId
  grade: {
    letter: string
    pct: number
    priorPct: number | null
    trend: 'up' | 'flat' | 'down' | 'new'
    trendPct: number | null
  } | null
  label: string
  laymanCopy: string
  period: Period
  trendExplanation?: TrendExplanation
  isSelected: boolean
  onSelectTrend: (id: CardId | null) => void
  isRubricSelected: boolean
  onSelectRubric: (id: CardId | null) => void
  newArrivalsCount?: number
  isArrivalsSelected?: boolean
  onSelectArrivals?: () => void
  isMobile: boolean
}) {
  const canShowTrend = Boolean(trendExplanation && period !== '60d')
  const canShowArrivals = Boolean(
    onSelectArrivals && newArrivalsCount > 0 && period !== '60d',
  )

  return (
    <div
      style={{
        background: isSelected || isRubricSelected || isArrivalsSelected ? 'var(--surface-2)' : 'var(--surface-1)',
        border: `1px solid ${isSelected || isRubricSelected || isArrivalsSelected ? 'var(--accent-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        boxShadow: 'var(--card-elevated)',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
    >
      <div style={{ marginBottom: '10px' }}>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '6px',
          }}
        >
          {label}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            marginBottom: '4px',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
          }}
        >
          <span
            style={{
              fontSize: '36px',
              lineHeight: 1,
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: grade ? gradeColor(grade.letter) : 'var(--text-muted)',
            }}
          >
            {grade?.letter ?? '—'}
          </span>

          {grade && (
            <span
              style={{
                fontSize: '18px',
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
              }}
            >
              {grade.pct}%
            </span>
          )}

          {grade && period !== '60d' && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <TrendArrow trend={grade.trend} />
              {formatTrendDelta(grade.pct, grade.priorPct, period)}
            </span>
          )}
        </div>
      </div>

      <p
        style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: '0 0 12px',
          flexGrow: 1,
        }}
      >
        {laymanCopy}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
        {canShowTrend && (
          <button
            type="button"
            onClick={() => onSelectTrend(isSelected ? null : cardId)}
            style={{
              fontSize: '12px',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              padding: '8px 0 0',
            }}
          >
            {isSelected ? 'Close ✕' : 'Why this trend? →'}
          </button>
        )}
        {canShowArrivals && (
          <button
            type="button"
            onClick={onSelectArrivals}
            style={{
              fontSize: '12px',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              padding: '8px 0 0',
            }}
          >
            {isArrivalsSelected ? 'Close ✕' : `New arrivals (${newArrivalsCount}) →`}
          </button>
        )}
        <button
          type="button"
          onClick={() => onSelectRubric(isRubricSelected ? null : cardId)}
          style={{
            fontSize: '12px',
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: '8px 0 0',
          }}
        >
          {isRubricSelected ? 'Close breakdown ✕' : 'Grade breakdown →'}
        </button>
      </div>
    </div>
  )
}

export default function GradesPanel({
  builderGrade24,
  builderGrade30,
  builderGrade7,
  builderGrade60,
  tokenMechanicGrade24,
  tokenMechanicGrade30,
  tokenMechanicGrade7,
  tokenMechanicGrade60,
  integrityGrade24,
  integrityGrade30,
  integrityGrade7,
  integrityGrade60,
  stats24h,
  stats30d,
  stats7d,
  stats60d,
  digestCards,
  githubStats = null,
  repos = [],
  communityContextEnabled = false,
}: Props) {
  const { period } = useGradePeriod()
  const isMobile = useIsMobile()
  const footerSize = isMobile ? '11px' : '10px'
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null)
  const [rubricCard, setRubricCard] = useState<CardId | null>(null)
  const [arrivalsCard, setArrivalsCard] = useState<ArrivalsCardId | null>(null)

  function handleSelectTrend(id: CardId | null) {
    setSelectedCard(id)
    if (id) {
      setRubricCard(null)
      setArrivalsCard(null)
    }
  }

  function handleSelectRubric(id: CardId | null) {
    setRubricCard(id)
    if (id) {
      setSelectedCard(null)
      setArrivalsCard(null)
    }
  }

  function handleSelectArrivals(id: ArrivalsCardId) {
    setArrivalsCard(prev => (prev === id ? null : id))
    setSelectedCard(null)
    setRubricCard(null)
  }

  const periodGrades = {
    '24h': {
      bg: builderGrade24,
      tg: tokenMechanicGrade24,
      ig: integrityGrade24,
      stats: stats24h,
    },
    '7d': {
      bg: builderGrade7,
      tg: tokenMechanicGrade7,
      ig: integrityGrade7,
      stats: stats7d,
    },
    '30d': {
      bg: builderGrade30,
      tg: tokenMechanicGrade30,
      ig: integrityGrade30,
      stats: stats30d,
    },
    '60d': {
      bg: builderGrade60,
      tg: tokenMechanicGrade60,
      ig: integrityGrade60,
      stats: stats60d,
    },
  } as const

  const { bg, tg, ig, stats } = periodGrades[period]

  const selectedExplanation =
    selectedCard === 'builder'
      ? bg?.trendExplanation
      : selectedCard === 'economic'
        ? tg?.trendExplanation
        : selectedCard === 'integrity'
          ? ig?.trendExplanation
          : undefined

  const digestHasPeriod =
    Boolean(digestCards?.[period]?.builder) &&
    Boolean(digestCards?.[period]?.economic) &&
    Boolean(digestCards?.[period]?.integrity)

  const builderCopy = digestHasPeriod
    ? digestCards![period].builder
    : bg
      ? builderCardLayman(bg, period, stats, githubStats, repos)
      : 'GitHub data unavailable'
  const economicCopy = digestHasPeriod
    ? digestCards![period].economic
    : tg
      ? economicCardLayman(tg, period, stats ? { commits: stats.commits } : null, githubStats, repos)
      : 'Token mechanic score unavailable'
  const integrityCopy = digestHasPeriod
    ? digestCards![period].integrity
    : ig
      ? integrityCardLayman(ig, period, githubStats, repos)
      : 'Builder standards score unavailable'

  const digestPeriodMissing =
    digestCards != null && digestMissingPeriodCards(digestCards, period)

  const statSpan = (text: string, fullWidth = false) => (
    <span style={{ fontSize: footerSize, color: 'var(--text-muted)', ...(fullWidth ? { flexBasis: '100%' } : {}) }}>
      {text}
    </span>
  )

  const cardStats: Record<CardId, React.ReactNode> = {
    builder: stats && (
      <>
        {statSpan(`${stats.commits} commits`)}
        {statSpan(`${stats.activeDays} active days`)}
        {statSpan(`${stats.newRepos} new repos`)}
      </>
    ),
    economic: tg?.counts && (
      <>
        {tg.counts.repos > 0 && statSpan(`${tg.counts.repos} holder-facing repos scored`)}
        {tg.holderCoveragePct != null && statSpan(`${tg.holderCoveragePct}% of commits holder-facing`)}
        {tg.qualityPct != null && tg.qualityPct !== tg.pct && statSpan(`quality ${tg.qualityPct}% before coverage`)}
        {tg.counts.high > 0 && statSpan(`${tg.counts.high} high-TM commits`)}
        {tg.counts.mid > 0 && statSpan(`${tg.counts.mid} mid-TM commits`)}
        {tg.counts.low > 0 && statSpan(`${tg.counts.low} low-TM commits`)}
        {period !== '60d' && tg.tagCommits && (
          <>
            {tg.tagCommits.direct > 0 && statSpan(`${tg.tagCommits.direct} direct-tag commits`)}
            {tg.tagCommits.lock > 0 && statSpan(`${tg.tagCommits.lock} supply-lock commits`)}
            {tg.tagCommits.indirect > 0 && statSpan(`${tg.tagCommits.indirect} indirect commits`)}
            {tg.tagCommits.infra > 0 && statSpan(`${tg.tagCommits.infra} infra/R&D commits`)}
          </>
        )}
      </>
    ),
    integrity: ig && (
      <>
        {statSpan(`${ig.counts.active} repos in sample`)}
        {ig.counts.commitWeight > 0 && statSpan(`${ig.counts.commitWeight} commits weighted`)}
        {ig.counts.high > 0 && statSpan(`${ig.counts.high} high-standards commits`)}
        {ig.counts.mid > 0 && statSpan(`${ig.counts.mid} mid commits`)}
        {ig.counts.low > 0 && statSpan(`${ig.counts.low} low-standards commits`)}
        {statSpan(integrityGradeFootnote(), true)}
      </>
    ),
  }

  const integrityDragNode =
    ig?.dragRepos && ig.dragRepos.length > 0 ? (
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Biggest drags on this grade
        </div>
        <ul style={{ margin: 0, paddingLeft: '16px' }}>
          {ig.dragRepos.map(r => (
            <li key={r.slug} style={{ marginBottom: '4px' }}>
              {r.name} — {r.pct}% standards, {r.commits} commit{r.commits === 1 ? '' : 's'} weighted
            </li>
          ))}
        </ul>
      </div>
    ) : null

  const integrityPathToCNode =
    ig?.pathToC && period !== '60d' ? (
      <div style={{ marginBottom: integrityDragNode ? '12px' : 0 }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          What would move this?
        </div>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          If weighted rubric quality rose ~{ig.pathToC.distancePct} points this window, the grade would reach C (~73%).
          Repos meeting{' '}
          <Link href={`/how-we-score#${ig.pathToC.anchor}`} style={{ color: 'var(--accent)' }}>
            typical {ig.pathToC.rowLabel} benchmarks
          </Link>{' '}
          would lift that row — not a prescription for any single project.
        </p>
      </div>
    ) : null

  const integrityBreakdownExtra = (
    <>
      {integrityPathToCNode}
      {integrityDragNode}
    </>
  )

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          marginBottom: '16px',
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: isMobile ? 'nowrap' : 'nowrap',
          gap: isMobile ? '10px' : '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: isMobile ? '10px' : '16px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Grades
          </span>
          <Link href="/how-we-score" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>
            How we score →
          </Link>
          {communityContextEnabled && (
            <Link
              href="/how-we-score#hw-score-community"
              style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}
            >
              Think we&apos;re missing something? Add context →
            </Link>
          )}
        </div>
        <div style={isMobile ? { width: '100%', display: 'flex' } : undefined}>
          <PeriodToggle />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
          gap: isMobile ? '10px' : '16px',
          alignItems: 'stretch',
        }}
      >
        <GradeCard
          cardId="builder"
          isMobile={isMobile}
          grade={bg}
          label="builder activity"
          period={period}
          laymanCopy={builderCopy}
          trendExplanation={bg?.trendExplanation}
          isSelected={selectedCard === 'builder'}
          onSelectTrend={handleSelectTrend}
          isRubricSelected={rubricCard === 'builder'}
          onSelectRubric={handleSelectRubric}
        />

        <GradeCard
          cardId="economic"
          isMobile={isMobile}
          grade={tg}
          label="Holder economics"
          period={period}
          laymanCopy={economicCopy}
          trendExplanation={tg?.trendExplanation}
          isSelected={selectedCard === 'economic'}
          onSelectTrend={handleSelectTrend}
          isRubricSelected={rubricCard === 'economic'}
          onSelectRubric={handleSelectRubric}
          newArrivalsCount={tg?.newArrivals?.length ?? 0}
          isArrivalsSelected={arrivalsCard === 'economic'}
          onSelectArrivals={() => handleSelectArrivals('economic')}
        />

        <GradeCard
          cardId="integrity"
          isMobile={isMobile}
          grade={ig}
          label="Builder Standards"
          period={period}
          laymanCopy={integrityCopy}
          trendExplanation={ig?.trendExplanation}
          isSelected={selectedCard === 'integrity'}
          onSelectTrend={handleSelectTrend}
          isRubricSelected={rubricCard === 'integrity'}
          onSelectRubric={handleSelectRubric}
          newArrivalsCount={ig?.newArrivals?.length ?? 0}
          isArrivalsSelected={arrivalsCard === 'integrity'}
          onSelectArrivals={() => handleSelectArrivals('integrity')}
        />
      </div>

      {digestPeriodMissing && (
        <p
          style={{
            marginTop: '10px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
          }}
        >
          Daily digest not cached for this window yet — card copy is from live scores.
        </p>
      )}

      {selectedCard && selectedExplanation && period !== '60d' && (
        <TrendDetailTray
          cardId={selectedCard}
          explanation={selectedExplanation}
          onClose={() => setSelectedCard(null)}
          isMobile={isMobile}
        />
      )}

      {arrivalsCard === 'economic' && tg?.newArrivals && tg.newArrivals.length > 0 && period !== '60d' && (
        <NewArrivalsTray
          cardId="economic"
          arrivals={tg.newArrivals}
          onClose={() => setArrivalsCard(null)}
          isMobile={isMobile}
        />
      )}

      {arrivalsCard === 'integrity' && ig?.newArrivals && ig.newArrivals.length > 0 && period !== '60d' && (
        <NewArrivalsTray
          cardId="integrity"
          arrivals={ig.newArrivals}
          onClose={() => setArrivalsCard(null)}
          isMobile={isMobile}
        />
      )}

      {rubricCard && (
        <RubricBreakdownTray
          cardId={rubricCard}
          statsNode={cardStats[rubricCard]}
          extraBelowStats={rubricCard === 'integrity' ? integrityBreakdownExtra : undefined}
          onClose={() => setRubricCard(null)}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}
