import {
  buildNormieWhatChangedBlurb,
  plainWorkFromCommitMessages,
  rescoreSummaryForDisplay,
  type RescoreSummaryRecord,
} from '../lib/rescoreSummaries'

const commit =
  'recon drop — ~/Desktop/recon → ~/recon (macOS TCC blocks cron from Desktop), and report 2026-08-16'

const work = plainWorkFromCommitMessages([commit])
if (!work || /~\/|TCC/i.test(work)) throw new Error(`bad work: ${work}`)
if (!/^a /i.test(work)) throw new Error(`work should be a noun phrase: ${work}`)

const blurb = buildNormieWhatChangedBlurb({
  repoName: 'clawd-morning-update',
  builderDeltaPct: 5,
  economicDeltaPct: 0,
  commitMessages: [commit],
})
if (/~\/|TCC|Builder-standards|landed moving/i.test(blurb)) {
  throw new Error(`bad blurb: ${blurb}`)
}
if (!/quality reading went up/i.test(blurb)) throw new Error(`missing score note: ${blurb}`)

const bad =
  'clawd-morning-update landed recon drop — ~/Desktop/recon → ~/recon (macOS TCC blocks cron from Desktop), and report 2026-08-16. Builder-standards went up.'

const meta: RescoreSummaryRecord = {
  summary: 'Some tech note.',
  summaryNormie: bad,
  oldTokenMechanic: 'F (40%) SL',
  newTokenMechanic: 'F (40%) SL',
  oldBuilderIntegrity: 'F+ (55%)',
  newBuilderIntegrity: 'F+ (59%)',
  oldScoredAt: '2026-08-16',
  newScoredAt: '2026-08-16',
  commits30dAtRescore: 10,
  rescoreAt: '2026-08-16T12:00:00.000Z',
}

const shown = rescoreSummaryForDisplay(meta, true, 'clawd-morning-update')
if (/~\/|TCC|Builder-standards|Some tech note/i.test(shown)) {
  throw new Error(`bad display rebuild: ${shown}`)
}

console.log('work:', work)
console.log('blurb:', blurb)
console.log('display:', shown)
console.log('morning-update plainify ok')
