// Holder Benefits page — curated $CLAWD / CV benefit history + live Redis signals.
import Link from 'next/link'
import HolderBenefitsTimeline from '@/components/HolderBenefitsTimeline'
import { sortedHolderBenefits, type HolderGradeMove } from '@/lib/holderBenefits'
import { REPOS } from '@/lib/scores'
import { getSlugsRescoredSince } from '@/lib/scoreHistory'
import { getRescoreSummaries, type RescoreSummaryRecord } from '@/lib/rescoreSummaries'
import { getBurnSnapshotForDisplay, type BurnSnapshot } from '@/lib/burnSnapshot'

export const metadata = {
  title: 'Holder Benefits — The Build Report',
  description: 'Dated history of concrete $CLAWD and CV value for holders: burns, supply locks, places CLAWD is used, holder-only access.',
}

export const dynamic = 'force-dynamic'

const HOLDER_TAGS = new Set(['direct', 'supply-lock'])
const RECENT_WINDOW_MS = 90 * 24 * 3600 * 1000

function pctFromLabel(label: string | null): number | null {
  const m = label?.match(/\((\d+)%\)/)
  return m ? Number(m[1]) : null
}

/**
 * Latest holder-economics grade moves on burn / supply-lock repos. A grade move is the
 * site's signal that the token path itself changed, not just commit volume.
 */
async function getRecentHolderGradeMoves(): Promise<HolderGradeMove[]> {
  try {
    const slugs = await getSlugsRescoredSince(Date.now() - RECENT_WINDOW_MS)
    if (!slugs.length) return []
    const summaries = await getRescoreSummaries(slugs)
    const repoBySlug = new Map(REPOS.map(r => [r.githubSlug, r]))

    const moves: HolderGradeMove[] = []
    for (const [slug, meta] of Object.entries(summaries) as [string, RescoreSummaryRecord][]) {
      const repo = repoBySlug.get(slug)
      if (repo && !HOLDER_TAGS.has(repo.tag)) continue
      // "SL" labels are shipping leverage (tooling), not a direct token path.
      if (/\bSL\b/.test(meta.newTokenMechanic ?? '') || /\bSL\b/.test(meta.oldTokenMechanic ?? '')) continue
      const oldPct = pctFromLabel(meta.oldTokenMechanic)
      const newPct = pctFromLabel(meta.newTokenMechanic)
      if (oldPct == null || newPct == null || oldPct === newPct) continue
      moves.push({
        slug,
        name: repo?.name ?? slug,
        rescoreAt: meta.rescoreAt,
        oldLabel: meta.oldTokenMechanic,
        newLabel: meta.newTokenMechanic,
        direction: newPct > oldPct ? 'up' : 'down',
        summary: meta.summary?.trim() ?? '',
        summaryNormie: meta.summaryNormie?.trim() || null,
      })
    }
    return moves.sort((a, b) => b.rescoreAt.localeCompare(a.rescoreAt))
  } catch (err) {
    console.error('[holder-benefits] failed to read recent grade moves', err)
    return []
  }
}

async function getSiteBurnSnapshot(): Promise<BurnSnapshot | null> {
  try {
    return await getBurnSnapshotForDisplay()
  } catch (err) {
    console.error('[holder-benefits] failed to read burn snapshot', err)
    return null
  }
}

export default async function HolderBenefitsPage() {
  const [gradeMoves, burn] = await Promise.all([getRecentHolderGradeMoves(), getSiteBurnSnapshot()])

  return (
    <>
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>
          ← Build Report
        </Link>
      </p>

      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        Holder Benefits
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Concrete $CLAWD and CV value, and when it landed: burns, supply locks, places you can use CLAWD, and
        holder-only access. Dates are when clawdbotatg or the Chronicle reported it; the mechanic may have gone live a
        few days earlier.
      </p>

      <HolderBenefitsTimeline benefits={sortedHolderBenefits()} gradeMoves={gradeMoves} burn={burn} />
    </>
  )
}
