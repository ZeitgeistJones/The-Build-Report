import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { getBuildBrief } from '@/lib/buildBrief'
import { getNeedle } from '@/lib/needle'

export const dynamic = 'force-dynamic'

/** Load cached Yesterday's build + Needle for the admin X share tool (no regeneration). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const denied = await guardAdmin(req, (body as { password?: unknown }).password)
  if (denied) return denied

  try {
    const [brief, needle] = await Promise.all([getBuildBrief(), getNeedle()])

    return NextResponse.json({
      ok: true,
      brief: brief
        ? {
            general: brief.general,
            generalNormie: brief.generalNormie ?? null,
            dateKey: brief.dateKey,
            repoCount: brief.repoCount,
            commitCount: brief.commitCount,
            generatedAt: brief.generatedAt,
          }
        : null,
      needle: needle
        ? {
            text: needle.text,
            textNormie: needle.textNormie ?? null,
            dateKey: needle.dateKey,
            repoCount: needle.repoCount,
            generatedAt: needle.generatedAt,
          }
        : null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load share posts'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
