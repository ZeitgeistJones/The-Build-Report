import { NextRequest, NextResponse } from 'next/server'
import { getPublicContextForRepo, isCommunityContextEnabled } from '@/lib/communityContext'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  if (!isCommunityContextEnabled()) {
    return NextResponse.json({ ok: true, enabled: false, submissions: [] })
  }

  const slug = req.nextUrl.searchParams.get('slug')?.trim()
  if (!slug) {
    return NextResponse.json({ ok: false, error: 'Missing slug' }, { status: 400 })
  }

  const viewer = req.nextUrl.searchParams.get('wallet')?.trim() || null
  const submissions = await getPublicContextForRepo(slug, viewer)

  return NextResponse.json({ ok: true, enabled: true, submissions })
}
