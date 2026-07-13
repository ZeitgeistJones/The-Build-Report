import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { yesterdayMountainDateKey } from '@/lib/buildBrief'
import { generateAndCacheNeedle } from '@/lib/needle'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  try {
    const needle = await generateAndCacheNeedle({ dateKey: yesterdayMountainDateKey() })
    return NextResponse.json({
      ok: true,
      generated: Boolean(needle),
      repoCount: needle?.repoCount ?? 0,
      text: needle?.text ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Needle generation failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
