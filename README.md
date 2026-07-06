# The Build Report

A plain English look at the clawdbotatg repos, scored and sourced.

## What it does

- Tracks GitHub activity for clawdbotatg in real time (commits, active days, new repos)
- Shows rolling builder activity grade, token mechanic grade, and overall composite grade (30d / 7d toggle with trend)
- Scores every major repo on token mechanic (or shipping leverage) and builder standards
- Each score is broken into three weighted components, each cited to a public source
- Wallet connect on Base mainnet — CLAWDGate tier 1 (10M+ $CLAWD) unlocks the full report
- Per-repo Score/Rescore via paid autoscore (0.000008 ETH to receiver-buy-and-burn)

## Setup

```bash
npm install
cp .env.example .env.local
# fill in your env vars
npm run dev
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Recommended | GitHub PAT — no scopes needed. Prevents rate limiting. |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis URL for admin notes |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis token |
| `ADMIN_PASSWORD` | Yes | Password for /admin page |
| `ANTHROPIC_API_KEY` | Yes (autoscore) | Claude API key for auto-inferred repo scores |
| `CRON_SECRET` | Yes (cron) | Random string; Vercel sends it as `Authorization: Bearer …` on daily autoscore cron |

## Deploy

Push to GitHub, connect to Vercel, add env vars in Vercel dashboard. Auto-deploys on push.

**Vercel Hobby:** cron jobs may run **once per day** only. This project uses `0 12 * * *` (12:00 UTC daily). Use `/admin` → **Run autoscore now** for immediate scoring (15 repos per run).

## Updating scores

Scores are in `lib/scores.ts`. Edit the rubric rows and verdicts directly. Add changelog entries in the `CHANGELOG` array at the bottom of the file.

## Stack

- Next.js 14 (App Router)
- wagmi + viem (Base wallet connect, CLAWDGate, paid scoring)
- Upstash Redis (admin notes + autoscore cache)
- GitHub public API (live activity data)
- Vercel (deployment)

## Disclaimer

Independent community project. Not affiliated with clawdbotatg, Austin Griffith, or any core team. Not financial advice. Scores are interpretive. See /about for full disclaimer.
