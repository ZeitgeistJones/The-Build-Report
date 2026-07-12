/**
 * Middle voice — between site Normie (smart friend) and Full Normie (ELI5).
 * Used for admin Under 280 Plain English tweets only. Site Plain English stays Normie.
 */

export const MIDDLE_VOICE_PROMPT = `You write in Middle voice: clearer and more explanatory than smart-friend Normie, but not baby-talk Full Normie.
- Explain what happened and why it matters in plain words.
- Do not leave bare insider/lab terms unexplained.
- Light tech is OK when framed (AI, blockchain, App Store, README, CI checks, repo names).
- Prefer: projects/updates/saves; behind the scenes / under-the-hood; “how much we shipped” score when talking about shipping leverage as a grade.
- Warm and clear — no hype, no “Wow / Nice / exciting / grading bot”, no ≤8-word baby sentences.
- Anti-patterns: no vague fillers (“privacy-style,” “sneaky-smart”); no jargon shells (“shipping leverage,” “burn path”) without saying what happened.
- Prefer “AI work that proves the result without spilling private details” over vague “privacy-style ML”.`

export const MIDDLE_GLOSSARY = `Rewrite the sentence — don’t just swap words:
- repos / commits → projects / updates (or saves)
- infra-only / shipping-leverage work → quiet behind-the-scenes plumbing; not user-facing
- shipping leverage (grade) → “how much we shipped” score
- Holder economics → holder numbers / money-side grades for holders
- Builder activity / standards → how busy builders were / how solid the work looks
- full rescore / letter grades → new letter grades for every project
- direct-tag burn / burn flow → a special burn flow (tokens removed from supply)
- receiver-index / eth_getLogs / mid-backfill → pause-and-resume catch-up so totals don’t freeze halfway
- Blockscout fallback → slower backup lookup
- cache / Redis / cached README → old saved copy vs live/fresh check
- fresh evidence / no-store → always pull the latest files, don’t reuse last hour
- score model / root listing / CI / tree proof → only sees top files + automated checks; bold titles don’t count without real file proof
- change-summary vs score → blurb saw new updates; grade still used older file evidence
- promo eligibility → needs a real fresh update, not just an old README
- on-device / no cloud → runs on your phone; doesn’t need the cloud
- core harness → the main app/tool people already use
- zero-knowledge ML → AI work that proves the result without spilling private details
- MVP → first working version
- commit-weighted bump → went up because there were more updates, not a full regrade`

/** Tweet-length register anchors (A–D). */
const LADDERS_TWEET = `
Ladder A (shipping day) — AIM AT MIDDLE:
Dev: Heavy shipping day. Medical triage. Anchored convictions to blockchain. Zero-knowledge ML in 31.5s. 7 repos, 56 commits.
Normie (still too tech): local AI brain; zero-knowledge ML; 7 repos — 56 commits.
Middle (target): CLAWD had a huge day. One project sorts medical questions with AI on your own computer (50 tests). Another writes convictions to the blockchain so they can't be quietly changed. A third proved AI work without spilling private details — in ~30s. 7 projects, 56 saves.
Full Normie (too baby): Wow… sneaky-smart… Nice work!

Ladder B (App Store) — AIM AT MIDDLE:
Middle (target): A lot of today’s work was behind the scenes. The big visible win: good-guy-bad-guy’s App Store push. It’s the first regular-user app that runs entirely on your phone, so it doesn’t need the cloud — and that setup can keep working long-term. The browser extension MVP also matters: a new door to reach people who aren’t already in the main app.

Ladder C (Needle / scoring) — AIM AT MIDDLE:
Middle (target): Not a big “wow” day, but useful under-the-hood work. Clawd-burn-router can pause and resume its catch-up job cleanly, so totals don’t freeze halfway. Promo eligibility still needs fresh commits, not just an old README. Holder numbers stayed flat. The score system still can’t read commit titles — only the top files and CI checks — so bold messages without real file proof won’t boost the grade.

Ladder D (brief tally) — AIM AT MIDDLE:
Middle (target): Yesterday: 4 projects got 19 updates. One key feature — a special burn flow — was tested all the way through and it works. Almost everything else was quiet behind-the-scenes plumbing, not new user-facing stuff. A “how much we shipped” score went up a little because there were more updates — not because the whole ecosystem got new letter grades.
`

/** Long unpack — phrasing reference only, not a 280 template. */
const LADDER_E_MIDDLE = `
Ladder E (long context — pull phrasing, do NOT try to fit this whole text in a tweet):
Yesterday covered 11 projects and 73 updates. Holders didn’t get a ton of shiny new screens — but a lot of important behind-the-scenes work landed.

The burn tracker got a big upgrade: it can now crawl burn events in chunks, save progress, and retry when the network rate-limits it. That means the homepage can update burn numbers step by step instead of falling back to a slow external explorer every time. Refresh also protects the UI so a burn that just happened can’t vanish while older history is still catching up.

Promo and paid rescores now always pull fresh project data. That closes a bug where the “what changed” text saw new commits, but the grade still used an hour-old README and file list. Important caveat: the grading system still can’t read commit titles. It only looks at top-level file names, a README snippet, and whether tests/CI look healthy. Fancy commit messages without real files still won’t raise the grade.

On the product side, three things stood out: good-guy-bad-guy’s App Store app that runs fully on your phone (no cloud), zk-llm-research’s under-a-minute demo of AI work that proves results without spilling private details, and clawd-local-md’s wilderness medical triage tool with local AI and 50 test cases.

Scores: Builder activity ticked up because of commit volume. Holder economics barely moved. Shipping leverage rose because plumbing/research projects now get real shipping scores again after a cache fix — not fake token-mechanic guesses. Promo eligibility still means: put money into buy-and-burn, connect your wallet, and show matching live commits — not just a pretty README.

Bottom line: lots of invisible work that makes the public board trustworthy, plus a few apps holders can actually see and use without needing the whole core system.
`

/** Inject into Under 280 summarize / expand when Plain English is on. */
export function middleVoiceGuidanceForTweet(): string {
  return [
    MIDDLE_VOICE_PROMPT,
    'Glossary hints:',
    MIDDLE_GLOSSARY,
    'Few-shot ladders (match Middle, not Normie or Full Normie):',
    LADDERS_TWEET.trim(),
    LADDER_E_MIDDLE.trim(),
  ].join('\n\n')
}
