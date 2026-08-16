/**
 * Deterministic checks for rescore "What changed" reject gates + plain fallbacks.
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
  plainWorkFromCommitMessages,
} from '../lib/rescoreSummaries'

const TECH_FAIL =
  'Recent clawd-research commits explore gpt-voice, eth-eval, lp-tls, webrtc-e2ee, noir, and local-ai topics—voice APIs, domain infrastructure, certificate deployment, cryptographic protocols, and inference economics—but none integrate into shipping workflows or establish downstream adoption paths. Role in ecosystem workflow row was moved to low because the active push cadence (2026-08-16) and 16 topic folders do not ground adoption in builder workflow or CI/testing visibility; clawd-research remains a transparent lab notebook without documented shipping leverage.'

const NORMIE_JARGON_COMMITS = [
  'gpt-voice: research + demo moved to clawdbotatg/gpt-voice project',
  'glm-53: GLM-5.3 open-source status + subscription access (weights ~end Aug, only Z.ai sub has it today)',
  'gpt-voice: OpenAI Realtime API research — semantic VAD, pricing, custom-voice gating',
]

const TECH_OK =
  'clawd-research commits poke at voice APIs, certs, WebRTC privacy, and local AI notes, but none of that work hooks into builder shipping tools or live products yet — it still reads as a transparent lab notebook.'

const NORMIE_OK =
  "clawd-research — Austin's been poking at voice APIs, expired domains, WebRTC privacy, and some AI hardware price stuff. Cool homework, but none of it showed up in tools builders actually ship with, so it still reads like a research notebook."

const SIBLING_TECH_OK =
  'fwaah landed a Base frontend redeploy and contract audit fixes; the live scorecard now credits that verifiable shipping path instead of scaffold-only framing.'

function expect(name: string, cond: boolean) {
  if (!cond) throw new Error(`FAIL: ${name}`)
  console.log(`ok — ${name}`)
}

expect('tech fail: circular', summaryIsCircularRestatement(TECH_FAIL) === true)
expect('tech fail: too long', summaryTooLong(TECH_FAIL) === true)
expect('tech fail: blames push', summaryBlamesPushCadenceForDrop(TECH_FAIL) === true)

expect('tech ok: not circular', summaryIsCircularRestatement(TECH_OK) === false)
expect('tech ok: length', summaryTooLong(TECH_OK) === false)
expect('tech ok: push blame', summaryBlamesPushCadenceForDrop(TECH_OK) === false)

expect('normie ok: voice', summaryNotNormieEnough(NORMIE_OK) === false)
expect('normie ok: length', summaryTooLong(NORMIE_OK) === false)

expect('sibling tech ok: circular', summaryIsCircularRestatement(SIBLING_TECH_OK) === false)
expect('sibling tech ok: length', summaryTooLong(SIBLING_TECH_OK) === false)
expect('sibling tech ok: push', summaryBlamesPushCadenceForDrop(SIBLING_TECH_OK) === false)

const work = plainWorkFromCommitMessages(NORMIE_JARGON_COMMITS)
expect('plain work exists', Boolean(work))
expect('plain work no semantic VAD', !/semantic vad/i.test(work || ''))
expect('plain work no custom-voice gating', !/custom-voice gating/i.test(work || ''))
console.log('plain work sample:', work)

const normieFallback = buildNormieWhatChangedBlurb({
  repoName: 'clawd-research',
  economicDeltaPct: 9,
  builderDeltaPct: 0,
  commitMessages: NORMIE_JARGON_COMMITS,
})
expect('fallback no look-elsewhere', !/open the rows|expand those rows|plain why/i.test(normieFallback))
expect('fallback no raw VAD', !/semantic vad/i.test(normieFallback))
expect('fallback has clawd-research', /clawd-research/i.test(normieFallback))
console.log('normie fallback sample:', normieFallback)

console.log('All rescore summary gate checks passed.')
