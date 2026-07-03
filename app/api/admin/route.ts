import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAdminNotes, setAdminNote, verifyAdminPassword } from '@/lib/admin'
import { flushAutoScore, listCachedAutoScores } from '@/lib/autoscore'
import { getChronicleContext, setChronicleContext } from '@/lib/chronicleContext'
import { getEcosystemContext, setEcosystemContext } from '@/lib/ecosystemContext'
import { getExcludedSlugs, setRepoExcluded } from '@/lib/repoExclude'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, password, repoId, note } = body

  const ok = await verifyAdminPassword(password)
  if (!ok) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  if (action === 'auth') {
    const notes = await getAdminNotes()
    const autoScored = await listCachedAutoScores()
    const excluded = await getExcludedSlugs()
    const chronicleContext = await getChronicleContext()
    const ecosystemContext = await getEcosystemContext()
    return NextResponse.json({
      ok: true,
      notes,
      autoScored,
      excluded,
      chronicleContext: chronicleContext ?? '',
      ecosystemContext: ecosystemContext ?? '',
    })
  }

  if (action === 'saveChronicleContext') {
    const text = typeof body.chronicleContext === 'string' ? body.chronicleContext : ''
    await setChronicleContext(text)
    return NextResponse.json({ ok: true })
  }

  if (action === 'saveEcosystemContext') {
    const text = typeof body.ecosystemContext === 'string' ? body.ecosystemContext : ''
    await setEcosystemContext(text)
    return NextResponse.json({ ok: true })
  }

  if (action === 'save') {
    await setAdminNote(repoId, note ?? '')
    return NextResponse.json({ ok: true })
  }

  if (action === 'flush') {
    // Clear a cached auto-score so it gets re-inferred on next page load
    await flushAutoScore(repoId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'exclude' || action === 'include') {
    const slug = typeof repoId === 'string' ? repoId.trim() : ''
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing repoId' }, { status: 400 })
    await setRepoExcluded(slug, action === 'exclude')
    revalidatePath('/')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}
