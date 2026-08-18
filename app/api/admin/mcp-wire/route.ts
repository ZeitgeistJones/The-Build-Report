import { NextRequest, NextResponse } from 'next/server'
import { guardAdmin } from '@/lib/admin'
import { yesterdayMountainDateKey } from '@/lib/buildBrief'
import { collectMcpWireDetailed, getMcpWireAdmin, wireRefreshSummary } from '@/lib/mcpWire'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Admin: inspect or refresh the MCP registry wire. */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { password, action } = body

  const denied = await guardAdmin(req, password)
  if (denied) return denied

  const editionKey = yesterdayMountainDateKey()

  try {
    if (action === 'refresh') {
      const record = await collectMcpWireDetailed(editionKey)
      return NextResponse.json({
        ok: true,
        wire: record.snapshot,
        admin: record,
        summary: wireRefreshSummary(record),
      })
    }

    const record = await getMcpWireAdmin(editionKey)
    return NextResponse.json({
      ok: true,
      dateKey: editionKey,
      wire: record?.snapshot ?? null,
      admin: record,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'MCP wire failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
