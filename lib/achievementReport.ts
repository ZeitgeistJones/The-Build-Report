import { getRedis } from '@/lib/redis'

const SCAN_REPORTED_PREFIX = 'br:scan-reported:'
const APP_ID = 'build-report'
const REPORT_KEY = 'first_scan'

function scanReportedKey(wallet: string): string {
  return `${SCAN_REPORTED_PREFIX}${wallet.toLowerCase()}`
}

/**
 * One-time first-scan achievement report — fire and forget.
 * Guard ensures we only report once per wallet, even if they rescore many times.
 * Never throws; Hub failures must not affect the rescore response.
 */
export function reportFirstScanIfNeeded(walletAddress: string): void {
  const wallet = walletAddress?.trim()
  if (!wallet) return

  const hubUrl = process.env.ACHIEVEMENT_HUB_URL?.replace(/\/$/, '')
  const secret = process.env.REPORT_SECRET
  if (!hubUrl || !secret) return

  void (async () => {
    try {
      const redis = getRedis()
      const key = scanReportedKey(wallet)
      const alreadyReported = await redis.get(key)
      if (alreadyReported) return

      // Mark first — before the fetch — so a retry can't double-fire.
      await redis.set(key, '1')

      await fetch(`${hubUrl}/api/report`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet,
          appId: APP_ID,
          key: REPORT_KEY,
        }),
      })
    } catch (e) {
      console.error('Achievement report failed:', e instanceof Error ? e.message : e)
    }
  })()
}
