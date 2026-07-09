import { pctToLetter } from './gradeLetters'
import { calcBuilderIntegrityPct } from './rubrics/builderIntegrity'
import { calcShippingLeveragePct } from './rubrics/shippingLeverage'

export type Tag = 'direct' | 'supply-lock' | 'indirect' | 'infrastructure' | 'theoretical'
export type Status = 'active' | 'dormant' | 'archived'
export type Level = 'high' | 'mid' | 'low'
export type Confidence = 'high' | 'mid' | 'low'

export interface RubricRow {
  label: string
  weight: string
  level: Level
  source: string
}

export interface Score {
  letter: string
  pct: number
  rubric: RubricRow[]
}

export interface Repo {
  id: string
  name: string
  githubSlug: string
  tag: Tag
  status: Status
  confidence: Confidence
  /** Direct CLAWD economic path — consumer and supply-lock repos. */
  tokenMechanic: Score | null
  /** Indirect multiplier value — indirect, infrastructure, and theoretical repos. */
  shippingLeverage?: Score | null
  builderIntegrity: Score
  verdict: string
  /** Optional plain-English ("normie") rewrite of the verdict, shown when Plain English mode is on. */
  normieVerdict?: string
  scoredAt: string
  adminNote?: string
  /** Ecosystem context version the AI read at score time. Omitted on legacy cached scores. */
  scoringContextVersion?: number
  /** How this score was written to cache — paid rescores persist without TTL. */
  scoreOrigin?: 'paid' | 'cron' | 'bulk'
  excluded?: boolean
}

function calcScore(rows: RubricRow[]): number {
  function parseWeight(w: string): number {
    if (w === 'equal') return 0.2
    const n = parseFloat(w)
    return Number.isFinite(n) ? n / 100 : 0
  }
  const levelMap: Record<Level, number> = { high: 3, mid: 2, low: 1 }
  let total = 0
  for (const row of rows) {
    total += parseWeight(row.weight) * levelMap[row.level]
  }
  return Math.round((total / 3) * 100)
}

/** Token mechanic rubric (3 rows, 50/30/20): (weighted sum ÷ 3) × 100. */
export function calcTokenMechanicPct(rows: RubricRow[]): number {
  return calcScore(rows)
}

/** Rubric rows → numeric score (0–100). Uses TM formula; prefer {@link calcTokenMechanicPct} or {@link calcBuilderIntegrityPct}. */
export function calcRubricPct(rows: RubricRow[]): number {
  return calcTokenMechanicPct(rows)
}

export function normalizeTokenMechanicScore(score: Score): Score {
  if (!score.rubric.length || score.letter === '—') return score
  const pct = calcTokenMechanicPct(score.rubric)
  return { ...score, pct, letter: pctToLetter(pct) }
}

export function normalizeBuilderIntegrityScore(score: Score): Score {
  if (!score.rubric.length || score.letter === '—') return score
  const pct = calcBuilderIntegrityPct(score.rubric)
  return { ...score, pct, letter: pctToLetter(pct) }
}

export function normalizeScore(score: Score): Score {
  if (!score.rubric.length || score.letter === '—') return score
  const pct = calcRubricPct(score.rubric)
  const letter = pctToLetter(pct)
  return { ...score, pct, letter }
}

export function normalizeShippingLeverageScore(score: Score): Score {
  if (!score.rubric.length || score.letter === '—') return score
  const pct = calcShippingLeveragePct(score.rubric)
  return { ...score, pct, letter: pctToLetter(pct) }
}

export function normalizeRepoScores(repo: Repo): Repo {
  if (repo.builderIntegrity.letter === '—' && !repo.builderIntegrity.rubric.length) {
    return repo
  }
  return {
    ...repo,
    tokenMechanic: repo.tokenMechanic ? normalizeTokenMechanicScore(repo.tokenMechanic) : null,
    shippingLeverage: repo.shippingLeverage
      ? normalizeShippingLeverageScore(repo.shippingLeverage)
      : repo.shippingLeverage ?? null,
    builderIntegrity: normalizeBuilderIntegrityScore(repo.builderIntegrity),
  }
}

function tm(rows: RubricRow[]): Score {
  const pct = calcScore(rows)
  return { letter: pctToLetter(pct), pct, rubric: rows }
}

function bi(rows: RubricRow[]): Score {
  const pct = calcScore(rows)
  return { letter: pctToLetter(pct), pct, rubric: rows }
}

export const REPOS: Repo[] = [
  {
    id: 'leftclaw-services',
    name: 'leftclaw-services',
    githubSlug: 'leftclaw-services',
    tag: 'direct',
    status: 'active',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'high', source: 'Chronicle ch.7, Mar 7 tweet' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'high', source: 'buy-and-burn on USDC payments' },
      { label: 'Mechanic is operational', weight: '20%', level: 'mid', source: 'burn on payment, not on access' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: '"hire me with ERC-8004" Feb 7' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'Chronicle ch.9' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'requires job runners to operate' },
    ]),
    verdict: 'The burn mechanic is real and the path to it is clear — pay for a job, CLAWD gets bought and burned. We\'re not measuring how much has burned, just that the plumbing is live and pointed the right direction.',
    normieVerdict: 'This is where the money actually moves. When someone pays for a job here, that payment is used to buy CLAWD and permanently destroy it — which slowly shrinks the supply, and that\'s generally good for people holding the token. We\'re not tracking exactly how much has been burned so far, just confirming the pipes are built and pointed the right way.',
  },
  {
    id: 'clawd-incinerator',
    name: 'clawd-incinerator',
    githubSlug: 'clawd-incinerator',
    tag: 'direct',
    status: 'dormant',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'high', source: '10M per call — Chronicle ch.3' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'high', source: 'caller incentive keeps it running' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: 'permanent destruction by design' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: '"every app burns CLAWD" Feb 11' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: '8hrs zero human — Chronicle ch.3' },
      { label: 'Passes walkaway test', weight: '25%', level: 'high', source: 'self-incentivising — Mar 17 tweet' },
    ]),
    verdict: 'Dormant because the community voted to stop refilling it — not because it failed. The mechanic itself was about as clean as it gets. Scores stay high because the design was right and it stepped aside correctly.',
    normieVerdict: 'This one\'s quiet now, but not because it broke — the community actually voted to stop topping it up. Its whole job was to destroy CLAWD tokens, and it did that about as cleanly as you can. It scores high because the design was solid and it bowed out gracefully when its job was done.',
  },
  {
    id: 'clawd-fomo3d',
    name: 'clawd-fomo3d-v2',
    githubSlug: 'clawd-fomo3d-v2',
    tag: 'direct',
    status: 'active',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'high', source: '20% of every pot burned — Chronicle ch.5' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'high', source: '25% dividends to key holders' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: '139M burned across rounds — Feb 3 tweet' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: '"build apps people love" Feb 4' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'playtested and fixed live — Chronicle ch.5' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'requires round management' },
    ]),
    verdict: 'Real burns, real payouts, real rounds. 38+ rounds and $18k+ paid out. The gamble mechanic evolved into something the community genuinely played. Burns happen on every key purchase automatically.',
    normieVerdict: 'This is a game people actually played — more than 38 rounds and over $18k paid out to real players. Every time someone buys in, a slice of CLAWD gets automatically destroyed, no one has to push a button. It started as a gamble and turned into something the community genuinely enjoyed.',
  },
  {
    id: 'clawd-pfp-market',
    name: 'clawd-pfp-market',
    githubSlug: 'clawd-pfp-market',
    tag: 'direct',
    status: 'dormant',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'high', source: '25% of stakes burned — Jan 29 tweet' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'mid', source: '65% to winners, one-off mechanic' },
      { label: 'Mechanic is operational', weight: '20%', level: 'mid', source: '4.1M burned in winning round' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: 'first real consumer app — Chronicle ch.2' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: '20 contract deploys iterating — Jan 29' },
      { label: 'Passes walkaway test', weight: '25%', level: 'low', source: 'required clawdbotatg as oracle' },
    ]),
    verdict: 'The first real consumer app. Burns 25% of every round automatically. Dormant now — it ran one round, did its job, and the community moved on. Scored on what it was, not what came after.',
    normieVerdict: 'This was the first real app regular people could use, not just a behind-the-scenes tool. A quarter of every round\'s money went straight to destroying CLAWD, automatically. It only ran once and then went quiet — we\'re grading it on what it actually was, not holding the quiet against it.',
  },
  {
    id: '1024x',
    name: '1024x',
    githubSlug: '1024x',
    tag: 'direct',
    status: 'active',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'high', source: '1% on every bet and win — Feb 21 tweet' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'high', source: 'dual burn on both sides of every play' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: 'ownership burned, fully immutable' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'mid', source: 'community-driven, not roadmap — Chronicle ch.4' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'multi-agent audited — Feb 21 tweet' },
      { label: 'Passes walkaway test', weight: '25%', level: 'high', source: 'ownership burned, no admin — Feb 26 tweet' },
    ]),
    verdict: 'Burns on both sides of every play and ownership is burned — nobody controls it. Builder integrity is mid on vision because it emerged from community demand rather than the stated roadmap, which is honest context not a criticism.',
    normieVerdict: 'Every play destroys a little CLAWD on both the bet and the win, so the token supply shrinks from two directions. On top of that, the builder threw away the keys — literally nobody can control or change it anymore. It scores a bit lower on "vision" only because the community asked for it rather than it being on the original plan, which is just honest context, not a knock.',
  },
  {
    id: 'clawdviction',
    name: 'clawdviction (larv.ai)',
    githubSlug: 'clawdviction',
    tag: 'supply-lock',
    status: 'active',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'low', source: 'CV burns are not CLAWD burns' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'mid', source: 'governance unlocks Leftclaw access' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: '8% of supply staked — Chronicle ch.9' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: '"stake CLAWD, train your larva" Mar 9' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'written audited deployed — Chronicle ch.6' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'requires governance participation' },
    ]),
    verdict: 'Burning CV is not burning CLAWD — important distinction. What LarvAI does do is lock supply: 8% of total CLAWD in a contract clawdbotatg wrote and deployed. That\'s real. Holder economics is mid because the direct burn mechanic isn\'t there, but the supply lock is significant.',
    normieVerdict: 'Quick but important distinction: this burns a different token (CV), not CLAWD itself, so don\'t confuse the two. What it does do for CLAWD is lock a big chunk away — about 8% of all of it is parked in a contract the builder wrote, so it can\'t be sold. That\'s meaningful, which is why it lands in the middle: no direct burning, but a serious amount of supply taken off the table.',
  },
  {
    id: 'clawd-vesting',
    name: 'clawd-vesting',
    githubSlug: 'clawd-vesting',
    tag: 'supply-lock',
    status: 'dormant',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'low', source: 'vesting not burning — no destruction' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'low', source: 'pure lock mechanic, no revenue path' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: '1.23B locked for 30 days — Chronicle ch.1' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: '"incentive alignment is the foundation" Feb 5' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'first ever deploy — Chronicle token vesting doc' },
      { label: 'Passes walkaway test', weight: '25%', level: 'high', source: 'anyone could call release() — 1063 txns' },
    ]),
    verdict: 'The first thing clawdbotatg ever built. Not a burn — a lock. 1.23B CLAWD removed from circulation for 30 days as a cryptographic commitment not to sell. Dormant because it completed its job. Builder integrity is high because it set the tone for everything that followed.',
    normieVerdict: 'This was the very first thing the builder ever made. It didn\'t destroy any CLAWD — instead it locked up a huge pile (1.23 billion tokens) for 30 days as a way of publicly promising "I\'m not going to dump these." It\'s quiet now because that job is finished, and it scores high because it set the honest tone for everything that came after.',
  },
  {
    id: 'liquidity-vesting',
    name: 'liquidity-vesting',
    githubSlug: 'liquidity-vesting',
    tag: 'supply-lock',
    status: 'active',
    confidence: 'mid',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'low', source: 'liquidity lock, not a burn' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'mid', source: 'earns swap fees during vest period' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: 'locked in Uniswap V3 position' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: 'liquidity that works while it waits — Mar 1' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: '"5 ETH in, 8 ETH out, 0 humans" Mar 8' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'requires multisig proposals' },
    ]),
    verdict: 'Locks CLAWD into a Uniswap V3 position that earns fees while vesting. Not a burn but a clever lock — the liquidity works while it waits. Builder integrity high because the "wrote, deployed, proposed transactions, Austin just signs" dynamic is a genuine demonstration of autonomous operation.',
    normieVerdict: 'This locks up CLAWD, but cleverly — instead of just sitting there, the locked tokens earn trading fees the whole time they\'re parked. So it\'s not destroying supply, it\'s a smart holding pen that stays productive. It scores well because the AI wrote and deployed it itself, with the human just signing off — a real example of it working on its own.',
  },
  {
    id: 'clawd-meme-arena',
    name: 'clawd-meme-arena',
    githubSlug: 'clawd-meme-arena',
    tag: 'direct',
    status: 'dormant',
    confidence: 'mid',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'high', source: '10% of all stakes burned — Feb 18 tweet' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'mid', source: 'community-judged payouts' },
      { label: 'Mechanic is operational', weight: '20%', level: 'mid', source: 'one round run, dormant since' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'mid', source: 'community-driven, gamble era' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'beta tested in private chat — Chronicle ch.4' },
      { label: 'Passes walkaway test', weight: '25%', level: 'low', source: 'clawdbotatg required as judge' },
    ]),
    verdict: 'Burns 10% of stakes automatically. One round ran, community voted on winners. Needs clawdbotatg as the judge so it doesn\'t fully pass the walkaway test. Good mechanic, limited by the oracle dependency.',
    normieVerdict: 'A meme contest where 10% of everything staked gets automatically destroyed. It ran one round and the community voted on the winners. The catch: it needs the builder to step in as the judge, so it can\'t fully run itself unattended — a good idea held back a little by that dependency.',
  },
  {
    id: 'zk-llm',
    name: 'zkllmapi-v2',
    githubSlug: 'zkllmapi-v2',
    tag: 'direct',
    status: 'active',
    confidence: 'mid',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'mid', source: 'accepts CLAWD as payment — Mar 23 tweet' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'mid', source: 'payment path exists, burn path less clear' },
      { label: 'Mechanic is operational', weight: '20%', level: 'low', source: 'small anonymity set, early stage' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: '"cypherpunk mode engaged" Mar 23' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'Noir ZK circuits, E2EE, TEE — Chronicle ch.8' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'requires server infrastructure' },
    ]),
    verdict: 'The most technically ambitious build in the ecosystem. ZK proofs, E2EE, TEE — genuinely novel. CLAWD accepted as payment but the burn path is less explicit than other apps. Builder integrity is high because this is exactly what cypherpunk mode promised.',
    normieVerdict: 'This is the most technically impressive thing in the whole lineup — serious privacy tech that keeps your data encrypted end to end and provable without exposing it. You can pay with CLAWD, but exactly how that translates into destroying tokens is fuzzier here than in the other apps. It scores high on trust because it delivered precisely the hardcore privacy build that was promised.',
  },
  {
    id: 'clawd-talk-to-wallet',
    name: 'denar.ai (talk-to-your-wallet)',
    githubSlug: 'clawd-talk-to-your-wallet',
    tag: 'indirect',
    status: 'active',
    confidence: 'mid',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Burn mechanic exists and is live', weight: '50%', level: 'low', source: 'no direct burn mechanic' },
      { label: 'Revenue or burn path built in', weight: '30%', level: 'mid', source: 'limited to CLAWD stakers — Mar 17 tweet' },
      { label: 'Mechanic is operational', weight: '20%', level: 'low', source: 'access gated not burn-gated' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: '"AI is the new UI" Mar 17 tweet' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'LiFi + Zerion + Claude Opus integration' },
      { label: 'Passes walkaway test', weight: '25%', level: 'low', source: 'expensive to run, requires subsidy' },
    ]),
    verdict: 'Plain English to onchain execution is a genuinely useful idea. Holder economics is low because access is staker-gated rather than burn-gated — holding CLAWD gets you in but nothing burns when you use it. Good for holders indirectly, not directly.',
    normieVerdict: 'The idea is genuinely handy — you type what you want in plain English and it does the crypto stuff for you. The reason it scores low for holders is that holding CLAWD just unlocks the door; actually using it doesn\'t destroy any tokens. So it\'s a nice perk for holders, but it doesn\'t directly move the needle on supply.',
  },
  {
    id: 'ethskills',
    name: 'ethskills',
    githubSlug: 'ethskills',
    tag: 'infrastructure',
    status: 'active',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Enables consumer apps that burn CLAWD', weight: '50%', level: 'high', source: 'directly improves quality of shipped apps' },
      { label: 'Downstream path to holder value', weight: '30%', level: 'mid', source: 'indirect — better tools, better burns' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: '6+ PRs merged Feb 2026 — Chronicle ch.3' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: '"missing knowledge layer" Feb 13' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'collaborative with Austin, open source' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'requires ongoing updates to stay current' },
    ]),
    verdict: 'Makes every future app smarter and more accurate. Its holder value is upstream — it shows in the quality of consumer apps built on top of it, not in the repo itself. The connection to burns is real, just indirect.',
    normieVerdict: 'Think of this as a shared knowledge pack that makes every app built on top of it smarter and more accurate. It doesn\'t touch tokens itself — its value shows up in the quality of the other apps that use it. The link to CLAWD is real, just one step removed.',
  },
  {
    id: 'dead-simple-agent',
    name: 'dead-simple-agent',
    githubSlug: 'dead-simple-agent',
    tag: 'infrastructure',
    status: 'active',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Enables consumer apps that burn CLAWD', weight: '50%', level: 'high', source: 'powers Leftclaw worker fleet directly' },
      { label: 'Downstream path to holder value', weight: '30%', level: 'high', source: 'Leftclaw burns CLAWD on every job — Mar 28' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: 'pip package, multi-provider — Mar 28 tweet' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: 'powers Leftclaw worker fleet — Chronicle ch.10' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: '~400 lines, pip package — Mar 28 tweet' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'framework requires orchestration' },
    ]),
    verdict: 'The agent framework powering the Leftclaw worker fleet. Every job that burns CLAWD runs on this. The downstream path to holder value is as direct as infrastructure gets — if Leftclaw earns, this is part of why.',
    normieVerdict: 'This is the toolkit that the paid worker agents are actually built on. Every job that ends up destroying CLAWD runs through this thing first. It\'s behind-the-scenes plumbing, but about as close to the money as plumbing gets — if the paid work earns, this is a big part of why.',
  },
  {
    id: 'clawd-containers',
    name: 'clawd-containers',
    githubSlug: 'clawd-containers',
    tag: 'infrastructure',
    status: 'active',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Enables consumer apps that burn CLAWD', weight: '50%', level: 'high', source: 'keeps the worker bot fleet running' },
      { label: 'Downstream path to holder value', weight: '30%', level: 'high', source: 'if this breaks, Leftclaw stops, burns stop' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: '5 agent types operational — Chronicle ch.9' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: 'runs the worker bots — Chronicle ch.9' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: '5 agent types, Docker/VM isolation' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'requires Mac Mini hardware to run' },
    ]),
    verdict: 'The factory floor. If this breaks, Leftclaw stops running and burns stop happening. The holder value is existential — not exciting but foundational.',
    normieVerdict: 'This is basically the engine room — the code that keeps the fleet of AI workers running on a Mac somewhere. It\'s not flashy, but if it goes down, the paid work stops and so does the token burning. Boring on the surface, absolutely essential underneath.',
  },
  {
    id: 'clawd-token-hub',
    name: 'clawd-token-hub',
    githubSlug: 'clawd-token-hub',
    tag: 'infrastructure',
    status: 'active',
    confidence: 'high',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Enables consumer apps that burn CLAWD', weight: '50%', level: 'low', source: 'read-only, no downstream burn path' },
      { label: 'Downstream path to holder value', weight: '30%', level: 'low', source: 'informs holders but does not move CLAWD' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: 'IPFS hosted, ENS set onchain — Chronicle ch.7' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: 'live price, buy, send — Chronicle ch.7' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'IPFS hosted, ENS content hash set onchain' },
      { label: 'Passes walkaway test', weight: '25%', level: 'high', source: 'read-only, no management needed' },
    ]),
    verdict: 'A window into the ecosystem, not an engine for it. Useful for holders wanting live price and stats but it doesn\'t move CLAWD in any direction. Holder economics is low by design — that\'s what it is.',
    normieVerdict: 'This is a dashboard — a window for checking the live price and stats. It\'s genuinely useful if you just want to see what\'s going on, but it doesn\'t buy, sell, or destroy any CLAWD. It scores low on holder economics on purpose, because that\'s simply not its job.',
  },
  {
    id: 'sponsored-8004',
    name: 'sponsored-8004',
    githubSlug: 'sponsor-clawdbotatg-eth',
    tag: 'infrastructure',
    status: 'active',
    confidence: 'mid',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Enables consumer apps that burn CLAWD', weight: '50%', level: 'mid', source: 'expands agent ecosystem that uses CLAWD' },
      { label: 'Downstream path to holder value', weight: '30%', level: 'low', source: 'theoretical — more agents could mean more burns' },
      { label: 'Mechanic is operational', weight: '20%', level: 'mid', source: 'gasless registration operational — Mar 2026' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: '"get agents onchain" — ERC-8004 guide Jan 31' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'EIP-7702 + ERC-8004 gasless registration' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'requires gas sponsorship funding' },
    ]),
    verdict: 'Pioneer work on gasless agent identity. The holder value is theoretical — more agents onchain expands the ecosystem clawdbotatg is building toward, which could mean more Leftclaw jobs and more burns. Early stage signal.',
    normieVerdict: 'This is early groundwork for letting AI agents get an on-chain identity without paying fees to do it. The payoff for holders is still theoretical — more agents out there could eventually mean more paid jobs and more token burning down the line. Promising, but very much an early signal, not a sure thing.',
  },
  {
    id: 'builder-agent',
    name: 'builder-agent',
    githubSlug: 'yet-another-builder-agent',
    tag: 'theoretical',
    status: 'active',
    confidence: 'low',
    scoredAt: '2026-06-15',
    tokenMechanic: tm([
      { label: 'Enables consumer apps that burn CLAWD', weight: '50%', level: 'mid', source: 'if mature, multiplies shipping capacity significantly' },
      { label: 'Downstream path to holder value', weight: '30%', level: 'low', source: 'potential only — no live mechanic yet' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: '25/25 pipeline steps passing — Apr 9 tweet' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: 'dApp pipeline automation — Chronicle ch.11' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: '25/25 pipeline steps passing — Apr 9 tweet' },
      { label: 'Passes walkaway test', weight: '25%', level: 'low', source: 'meta-tooling, not a live product' },
    ]),
    verdict: 'An agent that builds agents. If this matures it multiplies clawdbotatg\'s shipping capacity significantly. Holder value is potential not present — we\'re scoring R&D and confidence is low accordingly.',
    normieVerdict: 'This is an AI that builds other AIs. If it grows up, it could massively speed up how fast new apps get made. But right now the benefit to holders is potential, not real yet — we\'re grading an experiment, so we\'re keeping our confidence low on purpose.',
  },
  {
    id: 'clawd-harness',
    name: 'clawd-harness',
    githubSlug: 'clawd-harness',
    tag: 'infrastructure',
    status: 'active',
    confidence: 'mid',
    scoredAt: '2026-07-01',
    tokenMechanic: tm([
      { label: 'Enables consumer apps that burn CLAWD', weight: '50%', level: 'mid', source: 'multi-session dev harness for shipping clawdbotatg apps faster' },
      { label: 'Downstream path to holder value', weight: '30%', level: 'mid', source: 'fork of clawd-console — speeds interactive Claude Code builds' },
      { label: 'Mechanic is operational', weight: '20%', level: 'high', source: 'pushed Jun 30, 2026 — active development' },
    ]),
    builderIntegrity: bi([
      { label: 'Serves stated vision at time of build', weight: '40%', level: 'high', source: 'builder tooling aligned with autonomous shipping workflow' },
      { label: 'Genuine autonomous build', weight: '35%', level: 'high', source: 'forked from clawd-console, actively extended' },
      { label: 'Passes walkaway test', weight: '25%', level: 'mid', source: 'requires local/session setup to run' },
    ]),
    verdict: 'A multi-project web harness for interactive Claude Code sessions — builder infrastructure that speeds up shipping. Holder value is indirect: faster builds mean more consumer apps that can burn CLAWD.',
    normieVerdict: 'This is a workbench that lets the builder juggle several coding projects at once from the browser — basically a tool that makes shipping faster. The benefit to holders is indirect: quicker building means more apps get made, and more apps means more chances to burn CLAWD.',
  },
]

export const CHANGELOG = [
  {
    date: 'Jun 15, 2026',
    note: 'Initial scores published. Primary source: clawdbotatg Chronicle (Jan 25 – Apr 10, 2026) and public GitHub data.',
  },
  {
    date: 'Jun 15, 2026',
    note: 'LarvAI holder economics scored low on burn mechanic after confirming CV burns are not CLAWD burns.',
  },
  {
    date: 'Jun 15, 2026',
    note: '1024x builder integrity scored mid on vision because it emerged from community demand rather than stated roadmap — honest context, not a criticism.',
  },
  {
    date: 'Jul 3, 2026',
    note: 'Removed duplicate clawdlabs baseline — same GitHub repo as clawdviction. Larv.ai (gov forum, supply-lock) is the canonical score for that slug; the old burn-to-submit clawdlabs era is no longer a separate card.',
  },
  {
    date: 'Jul 6, 2026',
    note: 'Live AI scores now ground builder-integrity rows in GitHub repo evidence (README, root files, CI/tests flags). Paid rescores persist without cache TTL. Builder-activity signals reconciled: active days and longest dry spell now measure different things; rolling-baseline targets planned for a follow-up.',
  },
  {
    date: 'Jul 8, 2026',
    note: 'Launch rescore promo: free rescore on stale repos — ~$0.01 per stale commit to your wallet, plus a matching treasury subsidy for CLAWD burn fuel (50/50 split). Paid rescore paused during the promo so earn vs pay is not confused. Approx USD labels refresh weekly from ETH price; on-chain rewards are still ETH. Needs rescore filter surfaces eligible cards.',
  },
]
