import { NextRequest, NextResponse } from 'next/server'
import { getAdminNotes, setAdminNote, verifyAdminPassword } from '@/lib/admin'
import { flushAutoScore, listCachedAutoScores } from '@/lib/autoscore'
import { runGithubScanAndCache, getLastGithubScanAt, formatScanAt } from '@/lib/githubScan'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, password, repoId, note } = body

  const ok = await verifyAdminPassword(password)
  if (!ok) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  if (action === 'auth') {
    const notes = await getAdminNotes()
    const autoScored = await listCachedAutoScores()
    const lastGithubScanAt = await getLastGithubScanAt()
    return NextResponse.json({
      ok: true,
      notes,
      autoScored,
      lastGithubScanAt,
      lastGithubScanLabel: lastGithubScanAt ? formatScanAt(lastGithubScanAt) : null,
    })
  }

  if (action === 'scan') {
    try {
      const { stats, scannedAt } = await runGithubScanAndCache()
      return NextResponse.json({
        ok: true,
        scannedAt,
        scannedAtLabel: formatScanAt(scannedAt),
        rateLimited: stats.rateLimited,
        trackableRepos: stats.trackableRepos.length,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'GitHub scan failed'
      return NextResponse.json({ ok: false, error: message }, { status: 500 })
    }
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

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
}
