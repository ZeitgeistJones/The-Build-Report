# Agent notes — The Build Report

Operational facts for AI agents (and humans) working in this repo. Keep this short and current.

## Scoring cache & flushes

Live repo scores come from cached AI autoscores in Redis, refreshed by scans/rescores. A **cache
flush** clears those caches so every repo re-scores against the *current* prompt + context on the
next scan.

- **Last cache flush: July 6, 2026.** Anything scored on/after that date reflects the current
  scoring code, not stale baselines.
- The authoritative, machine-readable record is `CACHE_FLUSH_LOG` / `LAST_CACHE_FLUSH` in
  [lib/scoringContext.ts](lib/scoringContext.ts). **Read it before reasoning about score freshness,
  and add an entry there whenever you flush the cache.**
- The `scores.ts` `CHANGELOG` is the *user-facing* history of scoring methodology changes — not the
  same thing as the flush log.

Practical implication: the shipping-leverage rubric landed Jul 3, 2026, and the Jul 6 flush
re-scored everything after that — so the infra/indirect/theoretical ("leverage") repos carry
genuine `shippingLeverage` scores, not token-mechanic approximations. Don't assume repos need a
manual rescore for accuracy unless a repo's own score predates the last flush.

## Rescore evidence vs “what changed”

- The **score** model sees repo metadata + **root file names / README excerpt / CI-test flags** —
  not commit messages. Flat grades with ambitious commit titles usually mean thin tree evidence,
  not a skipped rescore.
- Commit messages feed only the **change-summary** blurb. That blurb must not invent
  “scored an older snapshot / before these commits” stories after a live rescore.
- **Jul 11, 2026:** paid/promo rescores pass `fresh: true` into `fetchRepoEvidence` /
  `fetchRepoBySlug` (`cache: 'no-store'`). Cron/bulk may still use the 1h cached path. Before
  that fix, rescores could score hour-old README/root listings while summaries already saw live
  commits — which looked like the scorer “ignored” new work.

## Burn tracker (CLAWD burned / last burn)

- Source of truth: receiver `Burned(uint256)` via RPC `eth_getLogs`, checkpointed in Redis
  (`build-report:burns:hub:rpc-index`). Base public RPC caps log ranges at 10k blocks — we
  chunk at 9k, retry on rate limits, and resume across cron/sync runs. Blockscout is fallback only.
- Homepage uses `getBurnSnapshotLiveMerged()` (`mode: 'display'`) — incremental catch-up only,
  write-back when chain is ahead of the display snapshot. Cold backfill is cron/`syncBurnSnapshot`.
- After `execute()`, `/api/burns/refresh` floors totals at pre+receipt amount so a mid-backfill
  index cannot leave the new burn off the UI; `appliedFromTx` only when receipt/index actually applied.

## Grades model (quick orientation)

Four **Ecosystem Grades** at the top of the homepage: Builder activity, Builder standards, and the
two holder-value lenses — **Holder economics** (direct-burn / supply-lock repos) and **Shipping
leverage** (infra/indirect/theoretical repos). Repo cards show per-repo grades; the ecosystem grades
are commit-weighted aggregates. Shipping leverage aggregates the same per-repo scores shown on cards.

## Workflow conventions

- Git: the agent **commits**, the user **pushes**. Don't push unless asked.

## Local debug tooling

After `npm install`, run `npm run setup:playwright` once (downloads Chromium for automation).

| Command | What it does |
|---------|----------------|
| `npm run debug:burn` | Live Blockscout CLAWD burn scan vs cache (no server needed) |
| `npm run debug:promo` | Compare promo eligibility vs live commits (`node scripts/debug-promo-eligibility.mjs <url> <CRON_SECRET> [slug]`) |
| `npm run debug:theme` | Playwright repro against production |
| `npm run debug:theme:local` | Same, against `localhost:3000` (start `npm run dev` first) |

Gated production debug APIs (use `CRON_SECRET` as `?key=`): `/api/debug/burn-totals`, `/api/debug/home-perf`, `/api/debug/commit-counts`, `/api/debug/promo-status`, `/api/debug/promo-eligibility`.
