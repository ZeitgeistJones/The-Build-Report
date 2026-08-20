import { NextResponse } from 'next/server'

export const maxDuration = 60

/**
 * Public paid Score/Rescore is retired — grades refresh overnight; operators use Admin.
 * Kept so old clients get a clear message instead of a confusing payment failure.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        'Live Score/Rescore on repo cards is retired. Grades and What changed refresh overnight when repos ship. Operators can rescore from Admin.',
    },
    { status: 410 },
  )
}
