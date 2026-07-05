/** Holder-facing rubric copy for How we score and tooltips. */

export type RubricReferenceRow = {
  label: string
  weight: string
  teaser: string
  detail: string
}

export type RubricReferenceBlock = {
  id: string
  title: string
  appliesTo: string
  note: string
  rows: RubricReferenceRow[]
  /** Repo-card rubrics vs ecosystem-only grade */
  scope: 'repo' | 'ecosystem'
}

export const RUBRIC_REFERENCE: RubricReferenceBlock[] = [
  {
    id: 'token-mechanic',
    title: 'Token mechanic',
    appliesTo: 'direct burn apps and supply-lock repos',
    note: 'Each row is low / mid / high (33 / 67 / 100). Score = weighted sum of row points. Supply-lock scores CLAWD lock impact — CV burns are not CLAWD burns.',
    scope: 'repo',
    rows: [
      {
        label: 'Direct CLAWD economic impact',
        weight: '50%',
        teaser: 'Does the repo move CLAWD — burn, lock, or route value to holders?',
        detail:
          'Score verifiable on-chain or in-product CLAWD impact: live burns, locks, thresholds, and holder-facing economics. Quiet can be healthy if the mechanism is callable and working as designed.',
      },
      {
        label: 'Mechanism clarity and holder relevance',
        weight: '30%',
        teaser: 'Can a holder understand what this app does to CLAWD?',
        detail:
          'Docs, UI, and repo evidence should make the economic role obvious. Obscured routing or vague “coming soon” mechanics score lower.',
      },
      {
        label: 'Alignment with CLAWD economic story',
        weight: '20%',
        teaser: 'Does it serve the “every consumer app burns CLAWD” mandate?',
        detail:
          'Consumer apps should reinforce the ecosystem thesis. Marketing-only repos score lower on direct impact but may still score on transparency elsewhere.',
      },
    ],
  },
  {
    id: 'shipping-leverage',
    title: 'Shipping leverage',
    appliesTo: 'infrastructure, indirect, and theoretical repos',
    note: 'Replaces token mechanic where direct burn is not expected. Score the multiplier on autonomous-builder shipping.',
    scope: 'repo',
    rows: [
      {
        label: 'Multiplies builder shipping capacity',
        weight: '40%',
        teaser: 'Does this repo let the builder ship more, faster?',
        detail:
          'Harnesses, scaffolds, containers, and critical-path infra score here. Active maintenance on shipping tools can score mid–high even with zero in-repo CLAWD burns.',
      },
      {
        label: 'Downstream path to holder value',
        weight: '35%',
        teaser: 'Is there a credible line from this work to holder-facing apps?',
        detail:
          'Score downstream products, integrations, and ecosystem wiring — not burns inside this repo. Critical-path repos get credit for enabling future burn apps.',
      },
      {
        label: 'Role in ecosystem workflow',
        weight: '25%',
        teaser: 'Is it wired into how clawdbotatg actually builds?',
        detail:
          'Initiation, dependencies, and real usage in the builder loop. Orphan tools with no path into shipping score lower.',
      },
    ],
  },
  {
    id: 'builder-integrity',
    title: 'Builder integrity',
    appliesTo: 'every repo — scoring rules vary by tag',
    note: 'Five rows, weighted sum. Infra uses different BI rules than burn apps (see row detail). CV is not CLAWD; supply lock is not a burn.',
    scope: 'repo',
    rows: [
      {
        label: 'On-chain commitments and constraints',
        weight: '22%',
        teaser: 'Contracts, locks, and architectural restraint — or honest absence of them.',
        detail:
          'Burn apps: verifiable on-chain commitments. Infra: no contract can be appropriate — score session boundaries, secrets handling, and restraint; not “missing Solidity.”',
      },
      {
        label: 'User funds, risk, and safety posture',
        weight: '20%',
        teaser: 'How are user funds and credentials protected?',
        detail:
          'Money-moving apps need fail-safes and clear fund flows. Dev tools with no user funds default mid; low only for careless credential exposure.',
      },
      {
        label: 'Transparency and verifiability',
        weight: '18%',
        teaser: 'Can outsiders verify what this repo claims?',
        detail:
          'Public code, documented scope, and reproducible claims score higher. Polished landing pages without on-chain routing score lower on TM, not automatically high here.',
      },
      {
        label: 'Governance, token-economics, and ecosystem alignment',
        weight: '20%',
        teaser: 'Does the repo align with the autonomous-builder / CLAWD thesis?',
        detail:
          'Infra should not default low for lacking holder UI. Score whether work supports shipping and honest ecosystem role — low only for misleading CLAWD claims.',
      },
      {
        label: 'Security, testing, and cryptographic rigor',
        weight: '20%',
        teaser: 'Evidence of security practice proportional to risk.',
        detail:
          'Rapid ships without tests can be mid, not auto-low. Low for obvious negligence — especially when recent commits introduce auth or crypto risk.',
      },
    ],
  },
  {
    id: 'builder-activity',
    title: 'Builder activity',
    appliesTo: 'ecosystem-wide grade only — not shown on repo cards',
    note: 'Each signal contributes up to 20%. Targets scale by 7d / 30d / 60d window.',
    scope: 'ecosystem',
    rows: [
      {
        label: 'Total commits in window',
        weight: '20%',
        teaser: 'Raw commit volume across the org.',
        detail: 'Compared to window target (e.g. 60 commits in 30d). Capped at 100% of target.',
      },
      {
        label: 'Active days in window',
        weight: '20%',
        teaser: 'Days with at least one commit.',
        detail: 'Rewards consistent presence, not single burst days.',
      },
      {
        label: 'New repos created',
        weight: '20%',
        teaser: 'New repos started in the window.',
        detail: 'Signals expansion of surface area — weighted modestly.',
      },
      {
        label: 'Repos with new commits',
        weight: '20%',
        teaser: 'Breadth — how many repos moved.',
        detail: 'Healthy ecosystems spread commits across many repos, not one hot project.',
      },
      {
        label: 'Commit consistency ratio',
        weight: '20%',
        teaser: 'Active days ÷ window length.',
        detail: 'Penalizes long dry spells relative to window size.',
      },
    ],
  },
]

export function rubricBlockById(id: string): RubricReferenceBlock | undefined {
  return RUBRIC_REFERENCE.find(b => b.id === id)
}

export const RUBRIC_REFERENCE_REPO = RUBRIC_REFERENCE.filter(b => b.scope === 'repo')
export const RUBRIC_REFERENCE_ECOSYSTEM = RUBRIC_REFERENCE.filter(b => b.scope === 'ecosystem')
