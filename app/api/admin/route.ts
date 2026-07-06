import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAdminNotes, setAdminNote, verifyAdminPassword } from '@/lib/admin'
import { flushAutoScore, listCachedAutoScores } from '@/lib/autoscore'
import { getChronicleContext, setChronicleContext } from '@/lib/chronicleContext'
import { getEcosystemContext, setEcosystemContext } from '@/lib/ecosystemContext'
import { getExcludedSlugs, setRepoExcluded } from '@/lib/repoExclude'
import {
  addCollectionSlug,
  addTrackableForceInclude,
  getCollectionsAdminState,
  isRepoCollectionId,
  removeCollectionSlug,
  removeTrackableForceInclude,
} from '@/lib/repoCollections'
import { adminAcceptSubmission, adminRemoveSubmission, listAllSubmissions } from '@/lib/communityContext'

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
    const { collections, forceInclude } = await getCollectionsAdminState()
    return NextResponse.json({
      ok: true,
      notes,
      autoScored,
      excluded,
      chronicleContext: chronicleContext ?? '',
      ecosystemContext: ecosystemContext ?? '',
      collections,
      forceInclude,
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

  if (action === 'addCollectionSlug') {
    const collectionId = typeof body.collectionId === 'string' ? body.collectionId : ''
    const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
    if (!isRepoCollectionId(collectionId) || !slug) {
      return NextResponse.json({ ok: false, error: 'Invalid collection or slug' }, { status: 400 })
    }
    await addCollectionSlug(collectionId, slug)
    revalidatePath('/')
    const { collections } = await getCollectionsAdminState()
    return NextResponse.json({ ok: true, collections })
  }

  if (action === 'removeCollectionSlug') {
    const collectionId = typeof body.collectionId === 'string' ? body.collectionId : ''
    const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
    if (!isRepoCollectionId(collectionId) || !slug) {
      return NextResponse.json({ ok: false, error: 'Invalid collection or slug' }, { status: 400 })
    }
    await removeCollectionSlug(collectionId, slug)
    revalidatePath('/')
    const { collections } = await getCollectionsAdminState()
    return NextResponse.json({ ok: true, collections })
  }

  if (action === 'addForceInclude') {
    const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing slug' }, { status: 400 })
    await addTrackableForceInclude(slug)
    revalidatePath('/')
    const { forceInclude } = await getCollectionsAdminState()
    return NextResponse.json({ ok: true, forceInclude })
  }

  if (action === 'removeForceInclude') {
    const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
    if (!slug) return NextResponse.json({ ok: false, error: 'Missing slug' }, { status: 400 })
    await removeTrackableForceInclude(slug)
    revalidatePath('/')
    const { forceInclude } = await getCollectionsAdminState()
    return NextResponse.json({ ok: true, forceInclude })
  }

  if (action === 'listContext') {
    const submissions = await listAllSubmissions()
    return NextResponse.json({ ok: true, submissions })
  }

  if (action === 'removeContext') {
    const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
    if (!submissionId) return NextResponse.json({ ok: false, error: 'Missing submissionId' }, { status: 400 })
    const removed = await adminRemoveSubmission(submissionId)
    console.log(`[admin] community context force-removed: ${submissionId} (found=${removed})`)
    revalidatePath('/')
    return NextResponse.json({ ok: removed, error: removed ? undefined : 'Submission not found' })
  }

  if (action === 'acceptContext') {
    const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
    if (!submissionId) return NextResponse.json({ ok: false, error: 'Missing submissionId' }, { status: 400 })
    const accepted = await adminAcceptSubmission(submissionId)
    console.log(`[admin] community context force-accepted: ${submissionId} (found=${accepted})`)
    revalidatePath('/')
    return NextResponse.json({ ok: accepted, error: accepted ? undefined : 'Submission not found or removed' })
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}
