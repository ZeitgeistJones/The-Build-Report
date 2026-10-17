// $CLAWD Mentions page — where and when $CLAWD came up across free public sources.
import Link from 'next/link'
import ClawdMentionsFeed from '@/components/ClawdMentionsFeed'
import { getClawdMentions } from '@/lib/clawdMentions'

export const metadata = {
  title: '$CLAWD Mentions — The Build Report',
  description: 'Where and when $CLAWD, clawdbotatg, and larv.ai were mentioned: Farcaster, Bluesky, Hacker News, GitHub, and podcasts.',
}

export const dynamic = 'force-dynamic'

export default async function ClawdMentionsPage() {
  const mentions = await getClawdMentions()

  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>
          ← Build Report
        </Link>
      </p>

      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        $CLAWD Mentions
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Where and when $CLAWD, clawdbotatg, larv.ai, or clawdviction came up: Farcaster, Bluesky, Hacker News, other
        people&apos;s GitHub repos, and slop.computer podcasts. Updated daily. X/Twitter isn&apos;t included — its search
        API is paid.
      </p>
      <p style={{ margin: '-14px 0 24px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Heads up: copycat tokens also called $CLAWD launched during the January Clawdbot hype, so a few cashtag posts
        may be about those, not clawdbotatg&apos;s $CLAWD on Base.
      </p>

      <ClawdMentionsFeed mentions={mentions} />
    </>
  )
}
