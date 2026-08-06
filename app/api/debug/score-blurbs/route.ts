import { NextRequest, NextResponse } from 'next/server'
import { guardDebugRoute } from '@/lib/debugAuth'
import { listCachedAutoScores, getCachedAutoScoresForSlugs } from '@/lib/autoscore'
import { REPOS } from '@/lib/scores'
import type { Repo, Score } from '@/lib/scores'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Blurb = {
  slug: string
  section: 'shippingLeverage' | 'tokenMechanic' | 'builderIntegrity' | 'verdict'
  label?: string
  text: string
}

function collectFromScore(
  slug: string,
  section: Blurb['section'],
  score: Score | null | undefined,
  out: Blurb[],
) {
  if (!score?.rubric?.length) return
  for (const row of score.rubric) {
    if (row.source?.trim()) {
      out.push({ slug, section, label: row.label, text: row.source.trim() })
    }
    if (row.sourceNormie?.trim()) {
      out.push({
        slug,
        section,
        label: `${row.label} (plain)`,
        text: row.sourceNormie.trim(),
      })
    }
  }
}

function collectFromRepo(repo: Repo, out: Blurb[]) {
  const slug = repo.githubSlug
  collectFromScore(slug, 'shippingLeverage', repo.shippingLeverage, out)
  collectFromScore(slug, 'tokenMechanic', repo.tokenMechanic, out)
  collectFromScore(slug, 'builderIntegrity', repo.builderIntegrity, out)
  if (repo.verdict?.trim()) {
    out.push({ slug, section: 'verdict', text: repo.verdict.trim() })
  }
  if (repo.normieVerdict?.trim()) {
    out.push({ slug, section: 'verdict', label: 'plain', text: repo.normieVerdict.trim() })
  }
}

/**
 * Dump rubric source blurbs from Redis autoscores (+ hand-scored baselines).
 * For dictionary mining: GET /api/debug/score-blurbs?key=CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const denied = guardDebugRoute(req)
  if (denied) return denied

  const blurbs: Blurb[] = []
  const seen = new Set<string>()

  for (const repo of REPOS) {
    collectFromRepo(repo, blurbs)
    seen.add(repo.githubSlug)
  }

  const cachedSlugs = await listCachedAutoScores()
  const need = cachedSlugs.filter(s => !seen.has(s))
  if (need.length) {
    const cached = await getCachedAutoScoresForSlugs(need)
    for (const repo of cached) collectFromRepo(repo, blurbs)
  }

  const texts = blurbs.map(b => b.text)
  return NextResponse.json({
    ok: true,
    count: blurbs.length,
    uniqueSlugs: new Set(blurbs.map(b => b.slug)).size,
    blurbs,
    /** Flat list for scanners that only need strings */
    texts,
  })
}
