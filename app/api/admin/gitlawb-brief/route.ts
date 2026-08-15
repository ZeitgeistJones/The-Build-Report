import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { yesterdayMountainDateKey } from '@/lib/buildBrief'
import {
  EXTERNAL_BRIEF_ACCOUNTS,
  generateAndCacheExternalDigest,
  getExternalBrief,
  getExternalBriefAccount,
  type ExternalBriefAccountId,
} from '@/lib/externalOwnerBrief'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Admin: load or regenerate a secondary-account Yesterday's Build (gitlawb, 1clawAI, …). */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { password, action } = body

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const accountIdRaw = typeof body.accountId === 'string' ? body.accountId : 'gitlawb'
  const account = getExternalBriefAccount(accountIdRaw)
  if (!account) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unknown account. Use one of: ${EXTERNAL_BRIEF_ACCOUNTS.map(a => a.id).join(', ')}`,
      },
      { status: 400 },
    )
  }
  const accountId = account.id as ExternalBriefAccountId
  const editionKey = yesterdayMountainDateKey()

  try {
    if (action === 'get' || !action) {
      const brief = await getExternalBrief(accountId, editionKey)
      return NextResponse.json({
        ok: true,
        accountId,
        brief,
        dateKey: editionKey,
      })
    }

    if (action === 'regenerate') {
      const digest = await generateAndCacheExternalDigest(accountId, {
        force: true,
        dateKey: editionKey,
      })
      const brief = await getExternalBrief(accountId, editionKey)
      return NextResponse.json({
        ok: true,
        accountId,
        brief,
        dateKey: digest.dateKey,
        repoCount: digest.repoCount,
        commitCount: digest.commitCount,
        generatedAt: digest.generatedAt,
      })
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : `${account.label} brief failed`
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
