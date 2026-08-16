/**
 * Fixloop repro for look-elsewhere / jargon What-changed blurbs.
 * Run: npx --yes tsx scripts/check-rescore-summary-gates.ts
 */
import {
  summaryBlamesPushCadenceForDrop,
  summaryIsCircularRestatement,
  summaryNotNormieEnough,
  summaryTooLong,
} from '../lib/rescoreChangeSummary'
import {
  buildNormieWhatChangedBlurb,
  extractCommitMessagesFromSummary,
  plainWorkFromCommitMessages,
  rescoreSummaryForDisplay,
  type RescoreSummaryRecord,
} from '../lib/rescoreSummaries'

const LOOK_ELSEWHERE = /open the rows|expand those rows|plain why|the move itself is not the reason/i
const SCARY_JARGON = /semantic vad|custom-voice gating|role in ecosystem workflow/i

/** Exact shape from the clawd-research screenshot (tech fallback). */
const CACHED_TECH =
  'Role in ecosystem workflow low → mid on this rescore. Expand those rows for the source notes that justify the new levels — the move itself is not the reason. Recent commits in this rescore window: gpt-voice: research + demo moved to clawdbotatg/gpt-voice project; glm-53: GLM-5.3 open-source status + subscription access (weights ~end Aug, only Z.ai sub has it today); gpt-voice: OpenAI Realtime API research — semantic VAD, pricing, custom-voice gating.'

/** Exact shape from the clawd-research screenshot (normie fallback). */
const CACHED_NORMIE =
  "clawd-research landed gpt-voice — research + demo moved to clawdbotatg/gpt-voice project; glm-53 — GLM-5.3 open-source status + subscription access (weights ~end Aug, only Z.ai sub has it today); and gpt-voice — OpenAI Realtime API research — semantic VAD, pricing, custom-voice gating. Money-side reading went up — open the rows below for the plain why."

const COMMITS = [
  'gpt-voice: research + demo moved to clawdbotatg/gpt-voice project',
  'glm-53: GLM-5.3 open-source status + subscription access (weights ~end Aug, only Z.ai sub has it today)',
  'gpt-voice: OpenAI Realtime API research — semantic VAD, pricing, custom-voice gating',
]

const TECH_OK =
  'clawd-research commits poke at voice APIs, certs, WebRTC privacy, and local AI notes, but none of that work hooks into builder shipping tools or live products yet — it still reads as a transparent lab notebook.'

const NORMIE_OK =
  "clawd-research — Austin's been poking at voice APIs, expired domains, WebRTC privacy, and some AI hardware price stuff. Cool homework, but none of it showed up in tools builders actually ship with, so it still reads like a research notebook."

const SIBLING_COMMITS = [
  'Redeploy fwaah frontend (Basescan verified)',
  'Port to Scaffold-ETH 2 + live Base frontend',
]

function expect(name: string, cond: boolean) {
  if (!cond) throw new Error(`FAIL: ${name}`)
  console.log(`ok — ${name}`)
}

function assertCleanBlurb(name: string, text: string) {
  expect(`${name}: non-empty`, text.trim().length > 20)
  expect(`${name}: no look-elsewhere`, !LOOK_ELSEWHERE.test(text))
  expect(`${name}: no scary jargon`, !SCARY_JARGON.test(text))
}

console.log('\n=== Attempt 1: failing case (cached clawd-research) ===')

const extracted = extractCommitMessagesFromSummary(CACHED_TECH)
expect('extract commits from cached tech', extracted.length >= 2)
console.log('extracted:', extracted)

const badMeta: RescoreSummaryRecord = {
  summary: CACHED_TECH,
  summaryNormie: CACHED_NORMIE,
  deltaHeader: 'Shipping leverage +9 pts (33% → 42%). Builder standards flat (59% → 59%).',
  oldTokenMechanic: 'F- (33%) SL',
  newTokenMechanic: 'F (42%) SL',
  oldBuilderIntegrity: 'F+ (59%)',
  newBuilderIntegrity: 'F+ (59%)',
  oldScoredAt: '2026-08-16T00:00:00.000Z',
  newScoredAt: '2026-08-16T12:00:00.000Z',
  commits30dAtRescore: 39,
  rescoreAt: '2026-08-16T12:00:00.000Z',
}

const displayedPlain = rescoreSummaryForDisplay(badMeta, true, 'clawd-research')
const displayedTech = rescoreSummaryForDisplay(badMeta, false, 'clawd-research')
console.log('display plain:', displayedPlain)
console.log('display tech:', displayedTech)
assertCleanBlurb('display plain', displayedPlain)
assertCleanBlurb('display tech', displayedTech)
expect('display mentions work', /voice|glm|gpt-voice/i.test(displayedPlain))

const directFallback = buildNormieWhatChangedBlurb({
  repoName: 'clawd-research',
  economicDeltaPct: 9,
  builderDeltaPct: 0,
  commitMessages: COMMITS,
})
console.log('direct fallback:', directFallback)
assertCleanBlurb('direct fallback', directFallback)

console.log('\n=== Confirmations: other aim (good LLM-shaped blurbs) ===')
expect('other tech: not circular', summaryIsCircularRestatement(TECH_OK) === false)
expect('other tech: length ok', summaryTooLong(TECH_OK) === false)
expect('other tech: no push-blame', summaryBlamesPushCadenceForDrop(TECH_OK) === false)
expect('other normie: voice ok', summaryNotNormieEnough(NORMIE_OK) === false)
expect('other normie: length ok', summaryTooLong(NORMIE_OK) === false)
assertCleanBlurb('other normie', NORMIE_OK)

const goodMeta: RescoreSummaryRecord = {
  ...badMeta,
  summary: TECH_OK,
  summaryNormie: NORMIE_OK,
}
expect(
  'good meta keeps stored normie',
  rescoreSummaryForDisplay(goodMeta, true, 'clawd-research') === NORMIE_OK,
)
expect(
  'good meta keeps stored tech',
  rescoreSummaryForDisplay(goodMeta, false, 'clawd-research') === TECH_OK,
)

console.log('\n=== Confirmations: sibling (shipping-path repo commits) ===')
const siblingWork = plainWorkFromCommitMessages(SIBLING_COMMITS)
console.log('sibling work:', siblingWork)
expect('sibling work exists', Boolean(siblingWork))
assertCleanBlurb('sibling work', siblingWork || '')

const siblingFallback = buildNormieWhatChangedBlurb({
  repoName: 'fwaah',
  economicDeltaPct: 5,
  builderDeltaPct: 0,
  commitMessages: SIBLING_COMMITS,
})
console.log('sibling fallback:', siblingFallback)
assertCleanBlurb('sibling fallback', siblingFallback)
expect('sibling mentions fwaah or work', /fwaah|redeploy|Scaffold-ETH|Base/i.test(siblingFallback))

console.log('\nAll fixloop checks passed.')
