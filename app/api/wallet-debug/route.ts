import { NextResponse } from 'next/server'

/** Temporary — remove after wallet connect issue is diagnosed. */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('[wallet-debug]', JSON.stringify(body))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
