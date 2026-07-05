'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BuilderGrade, TokenMechanicGrade, IntegrityGrade, formatTrendPct, TrendExplanation, Period } from '@/lib/grades'
import { gradeColor } from '@/lib/gradeLetters'
import { rubricBlockById } from '@/lib/rubricReference'
import { PeriodToggle, useGradePeriod } from './GradePeriodContext'
import { PulseMicrostats } from './EcosystemPulse'
import { EcosystemPulse } from '@/lib/ecosystemPulse'
import { integrityGradeFootnote } from '@/lib/cardFraming'
import { useIsMobile } from '@/hooks/useIsMobile'
import RubricBlockPanel from '@/components/RubricBlockPanel'

type CardId = 'builder' | 'economic' | 'integrity'

interface Props {
  pulse30: EcosystemPulse | null
  pulse7: EcosystemPulse | null
  pulse60: EcosystemPulse | null
  builderGrade30: BuilderGrade | null
  builderGrade7: BuilderGrade | null
  builderGrade60: BuilderGrade | null
  tokenMechanicGrade30: TokenMechanicGrade | null
  tokenMechanicGrade7: TokenMechanicGrade | null
  tokenMechanicGrade60: TokenMechanicGrade | null
  integrityGrade30: IntegrityGrade | null
  integrityGrade7: IntegrityGrade | null
  integrityGrade60: IntegrityGrade | null
  stats30d: { commits: number; activeDays: number; newRepos: number } | null
  stats7d: { commits: number; activeDays: number; newRepos: number } | null
  stats60d: { commits: number; activeDays: number; newRepos: number } | null
}

const TREND_UNAVAILABLE_60D = 'Trend requires 120d scan history'

const CARD_LABELS: Record<CardId, string> = {
  builder: 'Builder activity',
  economic: 'Burn apps (economic)',
  integrity: 'Builder integrity',
}

const CARD_RUBRIC_ID: Record<CardId, string> = {
  builder: 'builder-activity',
  economic: 'token-mechanic',
  integrity: 'builder-integrity',
}

function TrendArrow({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  if (trend === 'up') return <span style={{ color: 'var(--green)', fontSize: '12px' }}>↑</span>
  if (trend === 'down') return <span style={{ color: 'var(--red)', fontSize: '12px' }}>↓</span>
  return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
}

function RubricBreakdownTray({
  cardId,
  onClose,
  isMobile,
}: {
  cardId: CardId
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
      <RubricBlockPanel block={block} defaultOpen compact />
      <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
        <Link href={`/how-we-score#hw-rubric-${block.id}`} style={{ color: 'var(--accent)' }}>
          Full methodology →
        </Link>
      </p>
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
  mini,
  summary,
  period,
  footer,
  trendExplanation,
  isSelected,
  onSelectTrend,
  isRubricSelected,
  onSelectRubric,
  isMobile,
}: {
  cardId: CardId
  grade: {
    letter: string
    pct: number
    trend: 'up' | 'flat' | 'down'
    trendPct: number | null
  } | null
  label: string
  mini: string
  summary: string
  period: Period
  footer?: React.ReactNode
  trendExplanation?: TrendExplanation
  isSelected: boolean
  onSelectTrend: (id: CardId | null) => void
  isRubricSelected: boolean
  onSelectRubric: (id: CardId | null) => void
  isMobile: boolean
}) {
  const canShowTrend = Boolean(trendExplanation && period !== '60d')

  return (
    <div
      style={{
        background: isSelected || isRubricSelected ? 'var(--surface-2)' : 'var(--surface-1)',
        border: `1px solid ${isSelected || isRubricSelected ? 'var(--accent-border)' : 'var(--border)'}`,
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
              {formatTrendPct(grade.trendPct, period)}
            </span>
          )}

          {grade && period === '60d' && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                lineHeight: 1.3,
                maxWidth: isMobile ? undefined : 140,
              }}
            >
              {TREND_UNAVAILABLE_60D}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            maxWidth: 220,
          }}
        >
          {mini}
        </div>
      </div>

      <p
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: canShowTrend ? '8px' : '12px',
          flexGrow: 1,
        }}
      >
        {summary}
      </p>

      {footer && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '10px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 12px',
          }}
        >
          {footer}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: '4px' }}>
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
  pulse30,
  pulse7,
  pulse60,
  builderGrade30,
  builderGrade7,
  builderGrade60,
  tokenMechanicGrade30,
  tokenMechanicGrade7,
  tokenMechanicGrade60,
  integrityGrade30,
  integrityGrade7,
  integrityGrade60,
  stats30d,
  stats7d,
  stats60d,
}: Props) {
  const { period } = useGradePeriod()
  const isMobile = useIsMobile()
  const footerSize = isMobile ? '11px' : '10px'
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null)
  const [rubricCard, setRubricCard] = useState<CardId | null>(null)

  function handleSelectTrend(id: CardId | null) {
    setSelectedCard(id)
    if (id) setRubricCard(null)
  }

  function handleSelectRubric(id: CardId | null) {
    setRubricCard(id)
    if (id) setSelectedCard(null)
  }

  const bg = period === '30d' ? builderGrade30 : period === '7d' ? builderGrade7 : builderGrade60
  const tg = period === '30d' ? tokenMechanicGrade30 : period === '7d' ? tokenMechanicGrade7 : tokenMechanicGrade60
  const ig = period === '30d' ? integrityGrade30 : period === '7d' ? integrityGrade7 : integrityGrade60
  const stats = period === '30d' ? stats30d : period === '7d' ? stats7d : stats60d

  const selectedExplanation =
    selectedCard === 'builder'
      ? bg?.trendExplanation
      : selectedCard === 'economic'
        ? tg?.trendExplanation
        : selectedCard === 'integrity'
          ? ig?.trendExplanation
          : undefined

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
          {!isMobile && pulse30 && pulse7 && pulse60 && (
            <PulseMicrostats
              pulse30={pulse30}
              pulse7={pulse7}
              pulse60={pulse60}
              commits={stats?.commits}
            />
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
          mini="Recent GitHub activity quality across the selected window."
          summary={bg?.summary ?? 'GitHub data unavailable'}
          trendExplanation={bg?.trendExplanation}
          isSelected={selectedCard === 'builder'}
          onSelectTrend={handleSelectTrend}
          isRubricSelected={rubricCard === 'builder'}
          onSelectRubric={handleSelectRubric}
          footer={
            stats && (
              <>
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{stats.commits} commits</span>
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{stats.activeDays} active days</span>
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{stats.newRepos} new repos</span>
              </>
            )
          }
        />

        <GradeCard
          cardId="economic"
          isMobile={isMobile}
          grade={tg}
          label="burn apps (economic)"
          period={period}
          mini={
            period === '60d'
              ? 'Commit-weighted token mechanic scores for direct/supply-lock repos only — infra excluded.'
              : 'Burn-app economic scores only — infra and tools excluded from this average.'
          }
          summary={tg?.summary ?? 'Token mechanic score unavailable'}
          trendExplanation={tg?.trendExplanation}
          isSelected={selectedCard === 'economic'}
          onSelectTrend={handleSelectTrend}
          isRubricSelected={rubricCard === 'economic'}
          onSelectRubric={handleSelectRubric}
          footer={
            tg?.counts && (
              <>
                {tg.counts.repos > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.repos} repos in sample</span>
                )}
                {period === '60d' || !tg.tagCommits ? (
                  <>
                    {tg.counts.direct > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.direct} high-TM commits</span>
                    )}
                    {tg.counts.lock > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.lock} mid-TM commits</span>
                    )}
                    {tg.counts.indirect > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.indirect} low-TM commits</span>
                    )}
                  </>
                ) : (
                  <>
                    {tg.counts.direct > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.direct} high-TM commits</span>
                    )}
                    {tg.counts.lock > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.lock} mid-TM commits</span>
                    )}
                    {tg.counts.indirect > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.counts.indirect} low-TM commits</span>
                    )}
                    {tg.tagCommits.direct > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.tagCommits.direct} direct-tag commits</span>
                    )}
                    {tg.tagCommits.lock > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.tagCommits.lock} supply-lock commits</span>
                    )}
                    {tg.tagCommits.indirect > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.tagCommits.indirect} indirect commits</span>
                    )}
                    {tg.tagCommits.infra > 0 && (
                      <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{tg.tagCommits.infra} infra/R&D commits</span>
                    )}
                  </>
                )}
              </>
            )
          }
        />

        <GradeCard
          cardId="integrity"
          isMobile={isMobile}
          grade={ig}
          label="Builder Integrity"
          period={period}
          mini="Commit-weighted trust & safety on consumer apps and supply-lock repos (infra excluded)."
          summary={ig?.summary ?? 'Integrity score unavailable'}
          trendExplanation={ig?.trendExplanation}
          isSelected={selectedCard === 'integrity'}
          onSelectTrend={handleSelectTrend}
          isRubricSelected={rubricCard === 'integrity'}
          onSelectRubric={handleSelectRubric}
          footer={
            ig && (
              <>
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.active} repos in sample</span>
                {ig.counts.commitWeight > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.commitWeight} commits weighted</span>
                )}
                {ig.counts.high > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.high} high-integrity commits</span>
                )}
                {ig.counts.mid > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.mid} mid commits</span>
                )}
                {ig.counts.low > 0 && (
                  <span style={{ fontSize: footerSize, color: 'var(--text-muted)' }}>{ig.counts.low} low-integrity commits</span>
                )}
                <span style={{ fontSize: footerSize, color: 'var(--text-muted)', flexBasis: '100%' }}>{integrityGradeFootnote()}</span>
              </>
            )
          }
        />
      </div>

      {selectedCard && selectedExplanation && period !== '60d' && (
        <TrendDetailTray
          cardId={selectedCard}
          explanation={selectedExplanation}
          onClose={() => setSelectedCard(null)}
          isMobile={isMobile}
        />
      )}

      {rubricCard && (
        <RubricBreakdownTray cardId={rubricCard} onClose={() => setRubricCard(null)} isMobile={isMobile} />
      )}
    </div>
  )
}
