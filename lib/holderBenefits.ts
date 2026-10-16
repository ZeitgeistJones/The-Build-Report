/**
 * Holder Benefits — dated history of concrete $CLAWD / CV value for holders
 * (burns, supply locks, places CLAWD is used, holder-only access).
 *
 * Curated entries are sourced from the baseline score evidence in lib/scores.ts
 * (clawdbotatg tweets + Chronicle). Dates are when that source reported the
 * mechanic, which can trail the actual go-live by a few days.
 *
 * Pure data only — imported by a client component. Redis reads for the live
 * section live in app/benefits/page.tsx.
 */

export type HolderBenefitKind = 'burn' | 'lock' | 'utility' | 'access' | 'cv'

export interface HolderBenefit {
  /** ISO date used for sorting (approximate when dateLabel says so). */
  sortDate: string
  dateLabel: string
  kind: HolderBenefitKind
  project: string
  title: string
  detail: string
  /** Plain-English version for Normie mode. */
  detailNormie: string
  source: string
  /** True when the mechanic ran once / is dormant now — still history, not a live perk. */
  ended?: boolean
}

export const HOLDER_BENEFIT_KIND_LABELS: Record<HolderBenefitKind, string> = {
  burn: 'Burn',
  lock: 'Supply lock',
  utility: 'CLAWD use',
  access: 'Holder access',
  cv: 'CV / governance',
}

export const HOLDER_BENEFITS: HolderBenefit[] = [
  {
    sortDate: '2026-01-25',
    dateLabel: 'Late Jan 2026',
    kind: 'lock',
    project: 'clawd-vesting',
    title: '1.23B CLAWD locked for 30 days',
    detail:
      'The first thing clawdbotatg built: a vesting lock taking 1.23B CLAWD out of circulation for 30 days as an on-chain promise not to sell. 1,063 release() transactions since.',
    detailNormie:
      'The builder locked up 1.23 billion CLAWD for a month as a public "I won\'t dump" promise. Not destroyed, just parked where it couldn\'t be sold.',
    source: 'Chronicle ch.1',
    ended: true,
  },
  {
    sortDate: '2026-01-29',
    dateLabel: 'Jan 29, 2026',
    kind: 'burn',
    project: 'clawd-pfp-market',
    title: '25% of every round burned',
    detail:
      'First real consumer app. 25% of stakes in each round burned automatically; 4.1M CLAWD burned in the winning round.',
    detailNormie:
      'A picture contest where a quarter of everything people put in was destroyed for good. About 4.1 million CLAWD burned in the round that ran.',
    source: 'Jan 29 tweet · Chronicle ch.2',
    ended: true,
  },
  {
    sortDate: '2026-02-03',
    dateLabel: 'Feb 3, 2026',
    kind: 'burn',
    project: 'clawd-fomo3d-v2',
    title: '20% of every pot burned — 139M CLAWD so far',
    detail:
      'On-chain game: 20% of every pot burned on key purchases, 25% dividends to key holders. 139M CLAWD burned across rounds by Feb 3; 38+ rounds and $18k+ paid out.',
    detailNormie:
      'A game where a fifth of every prize pot gets destroyed. It had burned about 139 million CLAWD by early February and paid out over $18k to players.',
    source: 'Feb 3 tweet · Chronicle ch.5',
  },
  {
    sortDate: '2026-02-11',
    dateLabel: 'Feb 11, 2026',
    kind: 'burn',
    project: 'clawd-incinerator',
    title: 'Incinerator: 10M CLAWD per call',
    detail:
      'Direct burn contract that destroys 10M CLAWD per call, with a caller reward so anyone is incentivised to keep it running.',
    detailNormie:
      'A contract anyone can poke to destroy 10 million CLAWD at a time. Whoever triggers it gets a small reward, so it keeps running without the builder.',
    source: '"every app burns CLAWD" Feb 11 · Chronicle ch.3',
  },
  {
    sortDate: '2026-02-18',
    dateLabel: 'Feb 18, 2026',
    kind: 'burn',
    project: 'clawd-meme-arena',
    title: '10% of meme stakes burned',
    detail: 'Meme contest that burns 10% of all stakes automatically. One round ran with community-judged winners.',
    detailNormie: 'A meme contest where 10% of everything staked was destroyed. It ran one round.',
    source: 'Feb 18 tweet · Chronicle ch.4',
    ended: true,
  },
  {
    sortDate: '2026-02-21',
    dateLabel: 'Feb 21, 2026',
    kind: 'burn',
    project: '1024x',
    title: '1% burned on every bet and every win',
    detail:
      'Dual burn on both sides of every play. Ownership burned Feb 26 — fully immutable, nobody can change the rules.',
    detailNormie:
      'A betting game that destroys 1% when you bet and 1% when you win. On Feb 26 the admin keys were thrown away, so nobody can change it.',
    source: 'Feb 21 + Feb 26 tweets',
  },
  {
    sortDate: '2026-03-07',
    dateLabel: 'Mar 7, 2026',
    kind: 'burn',
    project: 'leftclaw-services',
    title: 'Pay for AI jobs → CLAWD bought and burned',
    detail:
      'AI job marketplace: users pay in USDC, the payment buys CLAWD on the market and burns it. Every job is buy pressure plus supply reduction.',
    detailNormie:
      'You pay (in dollars-coin) to hire the AI for a job, and that money is used to buy CLAWD and destroy it. More jobs, less CLAWD.',
    source: 'Mar 7 tweet · Chronicle ch.7',
  },
  {
    sortDate: '2026-03-08',
    dateLabel: 'Mar 8, 2026',
    kind: 'lock',
    project: 'liquidity-vesting',
    title: 'Liquidity locked in Uniswap V3, earning fees',
    detail:
      'CLAWD liquidity locked into a Uniswap V3 position that earns swap fees while it vests. "5 ETH in, 8 ETH out, 0 humans."',
    detailNormie:
      'CLAWD trading liquidity was locked up so it can\'t be pulled, and it earns trading fees the whole time.',
    source: 'Mar 1 + Mar 8 tweets',
  },
  {
    sortDate: '2026-03-09',
    dateLabel: 'Mar 9, 2026',
    kind: 'cv',
    project: 'clawdviction (larv.ai)',
    title: 'Stake CLAWD for CV — ~8% of supply locked',
    detail:
      'Larv.ai governance staking: stake CLAWD to earn CV (conviction) and steer what gets built. About 8% of total CLAWD supply staked. Note: CV burns are not CLAWD burns.',
    detailNormie:
      'Lock your CLAWD in Larv.ai to get CV, a voting points token for what gets built next. About 8% of all CLAWD is locked there. Burning CV does not burn CLAWD.',
    source: '"stake CLAWD, train your larva" Mar 9 · Chronicle ch.9',
  },
  {
    sortDate: '2026-03-17',
    dateLabel: 'Mar 17, 2026',
    kind: 'access',
    project: 'denar.ai (talk-to-your-wallet)',
    title: 'Staker-only: plain-English wallet agent',
    detail:
      'Talk-to-your-wallet (plain English → on-chain actions) launched limited to CLAWD stakers. Access perk; nothing burns on use.',
    detailNormie:
      'A tool where you type what you want and it does the crypto steps for you. Only CLAWD stakers can use it.',
    source: 'Mar 17 tweet',
  },
  {
    sortDate: '2026-03-23',
    dateLabel: 'Mar 23, 2026',
    kind: 'utility',
    project: 'zkllmapi-v2',
    title: 'Private AI API accepts CLAWD as payment',
    detail:
      'ZK-private LLM API (Noir circuits, E2EE, TEE) takes CLAWD as payment. Payment path is live; burn path is less explicit.',
    detailNormie: 'A private AI service you can pay for with CLAWD. Real use for the token.',
    source: 'Mar 23 tweet · Chronicle ch.8',
  },
  {
    sortDate: '2026-08-19',
    dateLabel: 'Aug 19, 2026',
    kind: 'burn',
    project: 'The Build Report',
    title: 'Every Score / Rescore buys and burns CLAWD',
    detail:
      'Score and Rescore on this site are paid again: 0.000008 ETH per run goes to the receiver contract, which buys CLAWD and burns it. Running Score/Rescore needs 10M+ CLAWD in a connected wallet (CLAWDGate).',
    detailNormie:
      'Each time someone rescores a project here, the small ETH fee buys CLAWD and destroys it. You need to hold 10M CLAWD to use it.',
    source: 'Build Report changelog Aug 19, 2026',
  },
]

/** Newest first. */
export function sortedHolderBenefits(): HolderBenefit[] {
  return [...HOLDER_BENEFITS].sort((a, b) => b.sortDate.localeCompare(a.sortDate))
}

export interface HolderGradeMove {
  slug: string
  name: string
  rescoreAt: string
  oldLabel: string | null
  newLabel: string | null
  direction: 'up' | 'down'
  summary: string
  summaryNormie: string | null
}