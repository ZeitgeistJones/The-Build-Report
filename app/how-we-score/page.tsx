import Link from 'next/link'
import { getChronicleBannerData } from '@/lib/chronicle'
import { getChronicleContext } from '@/lib/chronicleContext'
import { DEFAULT_ECOSYSTEM_CONTEXT, getEcosystemContext } from '@/lib/ecosystemContext'
import { isCommunityContextEnabled } from '@/lib/communityContext'
import HowWeScoreContent from '@/components/HowWeScoreContent'

export const metadata = {
  title: 'How we score — The Build Report',
  description: 'Methodology, rubrics, Chronicle summary, and scoring context for The Build Report.',
}

export default async function HowWeScorePage() {
  const [chronicle, override, chronicleContextText] = await Promise.all([
    getChronicleBannerData().catch(() => null),
    getEcosystemContext().catch(() => null),
    getChronicleContext().catch(() => null),
  ])
  const activeText = override?.trim() || DEFAULT_ECOSYSTEM_CONTEXT

  return (
    <main className="how-we-score-page" style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px 64px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>
          ← Build Report
        </Link>
      </p>

      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 24px', letterSpacing: '-0.02em' }}>
        How we score
      </h1>

      <HowWeScoreContent
        chronicle={chronicle}
        chronicleContextText={chronicleContextText}
        scoringContextText={activeText}
        scoringContextOverride={Boolean(override?.trim())}
        communityContextEnabled={isCommunityContextEnabled()}
      />
    </main>
  )
}
