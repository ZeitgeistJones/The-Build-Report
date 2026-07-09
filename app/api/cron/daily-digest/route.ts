import { NextRequest, NextResponse } from 'next/server'
import { loadGitHubStatsForCron } from '@/lib/githubStatsSnapshot'
import { generateAndCacheDailyDigest, loadReposForBrief } from '@/lib/buildBrief'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'brief-debug',hypothesisId:'B',location:'app/api/cron/daily-digest/route.ts',message:'cron missing CRON_SECRET',data:{},timestamp:Date.now()})}).catch(()=>{});
    console.log('[brief-debug]', JSON.stringify({hypothesisId:'B',location:'daily-digest',error:'CRON_SECRET not configured'}))
    // #endregion
    return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'brief-debug',hypothesisId:'A',location:'app/api/cron/daily-digest/route.ts',message:'cron unauthorized',data:{hasAuthHeader:Boolean(auth)},timestamp:Date.now()})}).catch(()=>{});
    console.log('[brief-debug]', JSON.stringify({hypothesisId:'A',location:'daily-digest',error:'Unauthorized',hasAuthHeader:Boolean(auth)}))
    // #endregion
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'brief-debug',hypothesisId:'A',location:'app/api/cron/daily-digest/route.ts',message:'cron invoked',data:{isVercelCron:req.headers.get('x-vercel-cron') === '1',schedule:req.headers.get('x-vercel-cron-schedule')},timestamp:Date.now()})}).catch(()=>{});
    console.log('[brief-debug]', JSON.stringify({hypothesisId:'A',location:'daily-digest',event:'invoked',isVercelCron:req.headers.get('x-vercel-cron') === '1',schedule:req.headers.get('x-vercel-cron-schedule')}))
    // #endregion

    const stats = await loadGitHubStatsForCron()
    if (!stats) {
      // #region agent log
      fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'brief-debug',hypothesisId:'B',location:'app/api/cron/daily-digest/route.ts',message:'no github stats snapshot',data:{},timestamp:Date.now()})}).catch(()=>{});
      console.log('[brief-debug]', JSON.stringify({hypothesisId:'B',location:'daily-digest',error:'No GitHub stats snapshot'}))
      // #endregion
      return NextResponse.json({ ok: false, error: 'No GitHub stats snapshot available' }, { status: 503 })
    }

    const repos = await loadReposForBrief(stats)
    const digest = await generateAndCacheDailyDigest(stats, repos)
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'brief-debug',hypothesisId:'B',location:'app/api/cron/daily-digest/route.ts',message:'cron digest ok',data:{dateKey:digest.dateKey,repoCount:digest.repoCount,commitCount:digest.commitCount,generatedAt:digest.generatedAt},timestamp:Date.now()})}).catch(()=>{});
    console.log('[brief-debug]', JSON.stringify({hypothesisId:'B',location:'daily-digest',event:'ok',dateKey:digest.dateKey,repoCount:digest.repoCount,commitCount:digest.commitCount}))
    // #endregion
    return NextResponse.json({
      ok: true,
      dateKey: digest.dateKey,
      repoCount: digest.repoCount,
      commitCount: digest.commitCount,
      generatedAt: digest.generatedAt,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Daily digest cron failed'
    // #region agent log
    fetch('http://127.0.0.1:7856/ingest/8feef998-a3c0-4f10-b60f-49dbcf37bc07',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ba045f'},body:JSON.stringify({sessionId:'ba045f',runId:'brief-debug',hypothesisId:'B',location:'app/api/cron/daily-digest/route.ts',message:'cron digest failed',data:{error:message},timestamp:Date.now()})}).catch(()=>{});
    console.log('[brief-debug]', JSON.stringify({hypothesisId:'B',location:'daily-digest',error:message}))
    // #endregion
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
