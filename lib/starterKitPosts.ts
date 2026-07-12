import { TBR_SITE_URL, X_CHAR_LIMIT, xWeightedLength } from '@/lib/xSharePosts'

export type StarterKitPost = {
  id: string
  title: string
  /** Three wording options for the same topic — cycle in admin if one doesn't land. */
  variants: [string, string, string]
}

/**
 * Evergreen site explainers for X — not Yesterday's Build / The Needle.
 * Voice: clear, friendly, light personality; building in the open where it fits.
 * No CLAWDGate / 10M hold talk in this kit.
 */
export const STARTER_KIT_POSTS: StarterKitPost[] = [
  {
    id: 'what',
    title: 'What it is',
    variants: [
      `The Build Report is a plain-English look at the clawdbotatg repos — scored and sourced, so you can follow what ships without living in GitHub.

Independent community project. Interpretive scores, not gospel.

${TBR_SITE_URL}`,
      `What is The Build Report?

A site that tracks clawdbotatg's GitHub work and scores each repo in plain English — holder impact, builder standards, and activity — with sources you can check.

${TBR_SITE_URL}`,
      `If you've ever wanted a readable map of the clawdbotatg stack instead of raw repos: that's The Build Report.

Scored. Sourced. Built for people who hold $CLAWD (and anyone curious).

${TBR_SITE_URL}`,
    ],
  },
  {
    id: 'why',
    title: 'Why it exists',
    variants: [
      `I built The Build Report because I wanted a clearer picture of what was shipping — without needing to read every commit myself.

Still figuring parts of it out in the open. The goal stays the same: make the work easier to follow.

${TBR_SITE_URL}`,
      `Why this site?

I hold $CLAWD and got tired of guessing what the repos meant. So I made a plain-English scoreboard — interpretive, not official, useful if you want the same clarity.

${TBR_SITE_URL}`,
      `The Build Report started as a personal need: less noise, more signal on what's actually being built.

It's a community project. Layout and copy may shift as I learn what helps — that's intentional.

${TBR_SITE_URL}`,
    ],
  },
  {
    id: 'who',
    title: "Who it's for",
    variants: [
      `Who The Build Report is for: holders and newcomers who want interpretive scores and context.

Who it isn't: financial advice, an official team product, or a real-time price feed.

${TBR_SITE_URL}`,
      `Use The Build Report if you want a calm read on repos and grades.

Skip it if you need investment advice or an "official" score from the core team — this isn't that.

${TBR_SITE_URL}`,
      `Built for people who care what's shipping around $CLAWD and prefer plain English over jargon.

Not affiliated with clawdbotatg or the core team. Scores are one reading of public info — yours can differ.

${TBR_SITE_URL}`,
    ],
  },
  {
    id: 'grades',
    title: 'How to read grades',
    variants: [
      `Quick read on The Build Report:

Top of the page = Ecosystem Grades (org-wide lenses).
Repo cards = dig into each project.

Toggle 24h / 7d / 30d / 60d. Grades are lenses, not verdicts.

${TBR_SITE_URL}`,
      `Those letter grades aren't a pass/fail on the whole ecosystem.

They're separate questions — activity, standards, holder impact, shipping leverage — for the window you pick. Open a card for the detail.

${TBR_SITE_URL}`,
      `How I use the grades on The Build Report:

1) Set a time window
2) Skim the four Ecosystem Grades
3) Open a few repo cards that stand out

Context beats a single letter.

${TBR_SITE_URL}`,
    ],
  },
  {
    id: 'lenses',
    title: 'Two holder-value lenses',
    variants: [
      `Two lenses on holder value on The Build Report:

Holder economics — apps that burn or lock $CLAWD.
Shipping leverage — tooling that helps those apps ship faster.

Different questions on purpose.

${TBR_SITE_URL}`,
      `Why some repos score on "shipping leverage" instead of burns:

They're the engine room — infra and tooling. They don't burn $CLAWD directly; they speed up the apps that do.

${TBR_SITE_URL}`,
      `A low Holder economics grade on an infra repo isn't a scandal — that rubric isn't built for it.

Shipping leverage is the other lens. Both sit at the top so you can see the split clearly.

${TBR_SITE_URL}`,
    ],
  },
  {
    id: 'rescore',
    title: 'Score, Rescore & burns',
    variants: [
      `Score / Rescore on The Build Report is one click on a repo card.

ETH goes to a buy-and-burn queue for $CLAWD. During the launch promo, eligible runs can pay your wallet and match that into the burn queue.

Once scored, everyone sees the result.

${TBR_SITE_URL}`,
      `Want a fresher grade on a card?

Hit Score or Rescore. It runs a live AI pass on the repo and caches the result for the site.

During the promo, eligible rescores can earn you ETH and fund burns — same click.

${TBR_SITE_URL}`,
      `Rescoring isn't just for you — it updates the shared scoreboard.

Payment (or the promo subsidy) feeds the CLAWD buy-and-burn path. Execute burn on the homepage clears the queue when there's ETH pending.

${TBR_SITE_URL}`,
    ],
  },
  {
    id: 'start',
    title: 'How to start',
    variants: [
      `New to The Build Report? Try this:

1) Filter to Needs rescore
2) Open one repo card and read the scorecard
3) Toggle Plain English if you want simpler copy

Site can evolve — I'm building this in the open.

${TBR_SITE_URL}`,
      `A simple way in:

Skim Yesterday's Build, then open any repo that catches your eye. Use the time toggles. Ignore jargon — Plain English is there for a reason.

Expect the UI to keep changing as I learn what helps.

${TBR_SITE_URL}`,
      `Start here, not overwhelmed:

Pick a time window → glance at Ecosystem Grades → open 1–2 cards.

That's enough for day one. The rest of the site is optional depth. Things may look different next month — that's fine.

${TBR_SITE_URL}`,
    ],
  },
]

/** Dev/helper: true if every variant fits the X weighted limit. */
export function starterKitAllWithinLimit(): boolean {
  return STARTER_KIT_POSTS.every(post =>
    post.variants.every(v => xWeightedLength(v) <= X_CHAR_LIMIT),
  )
}
