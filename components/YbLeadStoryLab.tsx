/**
 * Admin-only Lead Story Lab — CURRENT public lead vs proposed YB-LEAD-v1.
 * Does not change public Yesterday's Builds ranking.
 */

import {
  EXTERNAL_BRIEF_ACCOUNTS,
  type ExternalBriefAccountId,
  type ExternalBriefData,
} from '@/lib/externalOwnerBrief'
import {
  annotateCandidates,
  decideYbLeadV1,
  formatLeadConfidence,
  parseLeadPolicy,
  pickLegacyPublicLead,
  YB_LEAD_AXIS_MAX,
  YB_LEAD_EVENT_LABEL,
  YB_LEAD_MIN_CONFIDENCE,
  YB_LEAD_POLICY_VERSION,
  YB_LEAD_TIER_LABEL,
  type YbLeadCandidate,
  type YbLeadDecision,
  type YbLeadPolicy,
} from '@/lib/yesterdaysBuildsLeadPolicy'

type Props = {
  briefs: Partial<Record<ExternalBriefAccountId, ExternalBriefData | null>>
}

const AXIS_ROWS: Array<{
  key: keyof typeof YB_LEAD_AXIS_MAX
  label: string
}> = [
  { key: 'consequence', label: 'Consequence' },
  { key: 'audienceRelevance', label: 'Audience relevance' },
  { key: 'novelty', label: 'Novelty' },
  { key: 'deliveryEvidence', label: 'Delivery evidence' },
  { key: 'realChangeScope', label: 'Real scope' },
  { key: 'coherentMultiRepo', label: 'Multi-repo' },
  { key: 'validatedWorkDensity', label: 'Work density' },
]

function pct(n: number): string {
  return formatLeadConfidence(n)
}

function whyWon(decision: Extract<YbLeadDecision, { kind: 'lead' }>): string {
  const winner = decision.winner
  const runner = decision.runnerUp
  if (!runner) return 'Only eligible T1–T3 candidate with confidence of at least 75%.'
  if (runner.policy.tier > winner.policy.tier) {
    return `${runner.label} was T${runner.policy.tier}, so it could not outrank this T${winner.policy.tier} event even if it had more commits or a higher within-tier score.`
  }
  if (runner.policy.total !== winner.policy.total) {
    return `Same editorial tier as ${runner.label}; higher within-tier score won.`
  }
  if (runner.policy.consequence !== winner.policy.consequence) {
    return `Tied on tier and score with ${runner.label}; higher consequence won.`
  }
  return `Tied on the primary axes with ${runner.label}; remaining policy tie-breakers (evidence, audience, confidence, then stable project id) decided it.`
}

function AxisTable({ policy }: { policy: YbLeadPolicy }) {
  return (
    <dl className="yb-lead-lab__axes">
      {AXIS_ROWS.map(row => (
        <div key={row.key} className="yb-lead-lab__axis">
          <dt>{row.label}</dt>
          <dd>
            {policy[row.key]} / {YB_LEAD_AXIS_MAX[row.key]}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default function YbLeadStoryLab({ briefs }: Props) {
  const legacy = pickLegacyPublicLead(
    EXTERNAL_BRIEF_ACCOUNTS.map(account => {
      const brief = briefs[account.id]
      return {
        accountId: account.id,
        label: account.label,
        ticker: account.ticker,
        text: brief?.general ?? brief?.text ?? '',
        commitCount: brief?.commitCount ?? 0,
        repoCount: brief?.repoCount ?? 0,
        significance: brief?.significance,
      }
    }),
  )

  const analyzed: YbLeadCandidate[] = []
  const rows = EXTERNAL_BRIEF_ACCOUNTS.map(account => {
    const brief = briefs[account.id] ?? null
    const policy = parseLeadPolicy(brief?.leadPolicy)
    if (policy) analyzed.push({ accountId: account.id, label: account.label, policy })
    return { account, brief, policy }
  })

  const decision = decideYbLeadV1(analyzed)
  const table = annotateCandidates(analyzed)
  const missingCount = rows.filter(r => r.brief && !r.policy).length

  return (
    <section className="yb-lead-lab" aria-label="Lead story lab">
      <header className="yb-lead-lab__head">
        <p className="yb-lead-lab__kicker">Lead story lab · Admin</p>
        <h3 className="yb-lead-lab__title">Why this became the lead</h3>
        <p className="yb-lead-lab__note">
          Public /daily-loop now ranks with {YB_LEAD_POLICY_VERSION} when classifications
          exist. This lab still shows the legacy formula beside it so you can spot disagreements.
          Token ticker, stars, and raw commit/repo counts get zero ranking points in v1.
        </p>
      </header>

      <div className="yb-lead-lab__compare">
        <article className="yb-lead-lab__card">
          <p className="yb-lead-lab__card-kicker">Legacy formula (reference)</p>
          <p className="yb-lead-lab__card-name">{legacy ? legacy.label : 'None filed'}</p>
          <p className="yb-lead-lab__muted">
            Existing methodology — significance × 100 + capped commits + repo count × 2 + ticker
            bonus.
          </p>
        </article>

        <article className="yb-lead-lab__card yb-lead-lab__card--proposed">
          <p className="yb-lead-lab__card-kicker">Public lead — {YB_LEAD_POLICY_VERSION}</p>
          {decision.kind === 'unavailable' ? (
            <>
              <p className="yb-lead-lab__card-name">Unavailable</p>
              <p className="yb-lead-lab__muted">{decision.why}</p>
            </>
          ) : decision.kind === 'no-material-lead' ? (
            <>
              <p className="yb-lead-lab__card-name">No material lead today</p>
              <p className="yb-lead-lab__muted">{decision.why}</p>
            </>
          ) : (
            <>
              <p className="yb-lead-lab__card-name">{decision.winner.label}</p>
              <p className="yb-lead-lab__muted">
                {YB_LEAD_TIER_LABEL[decision.winner.policy.tier]} · {decision.winner.policy.total}/100
                · {pct(decision.winner.policy.confidence)}
              </p>
            </>
          )}
        </article>
      </div>

      {decision.kind === 'unavailable' && (
        <p className="yb-lead-lab__body">
          Lead Policy v1 analysis unavailable for this cached edition. Regenerate a project’s
          Yesterday’s Builds writeup to classify it. Older caches keep working without this
          field — nothing is fabricated.
        </p>
      )}

      {decision.kind === 'no-material-lead' && (
        <div className="yb-lead-lab__explain">
          <h4>Proposed lead</h4>
          <p className="yb-lead-lab__card-name">No material lead today</p>
          <p>
            Why: no project produced a T1–T3 event with sufficient evidence/confidence (need
            confidence ≥ {Math.round(YB_LEAD_MIN_CONFIDENCE * 100)}%).
          </p>
          {decision.bestObserved && (
            <p>
              Best observed activity: <strong>{decision.bestObserved.label}</strong>
              {' — '}
              {YB_LEAD_TIER_LABEL[decision.bestObserved.policy.tier]}. This avoids turning
              routine engineering into a fake front-page story.
            </p>
          )}
          <p className="yb-lead-lab__muted">Policy: {YB_LEAD_POLICY_VERSION}</p>
        </div>
      )}

      {decision.kind === 'lead' && (
        <div className="yb-lead-lab__explain">
          <h4>Proposed lead</h4>
          <p className="yb-lead-lab__card-name">{decision.winner.label}</p>
          <p>
            {YB_LEAD_TIER_LABEL[decision.winner.policy.tier]}
            <br />
            Within-tier score: {decision.winner.policy.total}/100
            <br />
            Confidence: {pct(decision.winner.policy.confidence)}
            <br />
            Event: {YB_LEAD_EVENT_LABEL[decision.winner.policy.eventType]}
          </p>
          <p>
            <strong>What changed:</strong> {decision.winner.policy.whatChanged}
          </p>
          <h4>Why it won</h4>
          <p>{whyWon(decision)}</p>
          <AxisTable policy={decision.winner.policy} />
          {decision.runnerUp && (
            <p>
              Runner-up: <strong>{decision.runnerUp.label}</strong>
              {' — '}
              {YB_LEAD_TIER_LABEL[decision.runnerUp.policy.tier]},{' '}
              {decision.runnerUp.policy.total}/100, {pct(decision.runnerUp.policy.confidence)}.
            </p>
          )}
          {decision.winner.policy.excludedNoise?.length ? (
            <div>
              <p>
                <strong>Excluded noise</strong>
              </p>
              <ul>
                {decision.winner.policy.excludedNoise.map((row, i) => (
                  <li key={i}>
                    {row.count != null ? `${row.count} — ` : ''}
                    {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {decision.winner.policy.evidenceSummary.length > 0 && (
            <div>
              <p>
                <strong>Evidence available</strong>
              </p>
              <ul>
                {decision.winner.policy.evidenceSummary.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {decision.winner.policy.uncertainty.length > 0 && (
            <div>
              <p>
                <strong>Uncertainty</strong>
              </p>
              <ul>
                {decision.winner.policy.uncertainty.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="yb-lead-lab__muted">Policy: {YB_LEAD_POLICY_VERSION}</p>
        </div>
      )}

      {missingCount > 0 && decision.kind !== 'unavailable' && (
        <p className="yb-lead-lab__muted">
          {missingCount} cached brief{missingCount === 1 ? '' : 's'} in this edition have no Lead
          Policy v1 fields yet — regenerate those desks to classify them.
        </p>
      )}

      <details className="yb-lead-lab__table-wrap">
        <summary>All classified candidates this edition</summary>
        {table.length === 0 ? (
          <p className="yb-lead-lab__muted">No Lead Policy v1 rows on file.</p>
        ) : (
          <div className="yb-lead-lab__table-scroll">
            <table className="yb-lead-lab__table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Tier</th>
                  <th>Score</th>
                  <th>Confidence</th>
                  <th>Event type</th>
                  <th>Lead eligible?</th>
                  <th>Reason if not</th>
                </tr>
              </thead>
              <tbody>
                {table.map(row => (
                  <tr key={row.accountId}>
                    <td>{row.label}</td>
                    <td>T{row.policy.tier}</td>
                    <td>{row.policy.total}</td>
                    <td>{pct(row.policy.confidence)}</td>
                    <td>{YB_LEAD_EVENT_LABEL[row.policy.eventType]}</td>
                    <td>{row.eligible ? 'YES' : 'NO'}</td>
                    <td>{row.ineligibleReason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  )
}
