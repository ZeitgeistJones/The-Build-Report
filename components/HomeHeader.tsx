'use client'

import RescoreBurnTracker from '@/components/RescoreBurnTracker'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  rescoreBurns: {
    count: number
    ethPendingInReceiver: number
    clawdBurnedOnChain: number
    lastBurnAt: string | null
  } | null
  latestCommitLabel?: string | null
  dataAsOfLabel?: string | null
  dataStale?: boolean
}

export default function HomeHeader({ rescoreBurns, latestCommitLabel, dataAsOfLabel, dataStale }: Props) {
  const isMobile = useIsMobile()
  const showBurn =
    rescoreBurns &&
    (rescoreBurns.count > 0 || rescoreBurns.clawdBurnedOnChain > 0 || rescoreBurns.ethPendingInReceiver > 0)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? '12px' : '24px',
        marginBottom: '8px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: isMobile ? '15px' : '16px',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            margin: 0,
            maxWidth: '56ch',
          }}
        >
          A plain English look at the repos, scored and sourced.
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
          Independent community project · Interpretive scores ·{' '}
          <a href="/about" style={{ color: 'var(--accent)' }}>
            Disclaimer
          </a>
          {latestCommitLabel && (
            <>
              {' '}
              · {latestCommitLabel}
            </>
          )}
          {dataAsOfLabel && (
            <>
              {' '}
              · Updated {dataAsOfLabel}
              {dataStale && (
                <span style={{ color: 'var(--text-muted)' }}> (refresh delayed)</span>
              )}
            </>
          )}
        </p>
      </div>

      {showBurn && (
        <div style={{ flexShrink: 0, alignSelf: isMobile ? 'stretch' : 'flex-start' }}>
          <RescoreBurnTracker
            count={rescoreBurns!.count}
            ethPendingInReceiver={rescoreBurns!.ethPendingInReceiver}
            clawdBurnedOnChain={rescoreBurns!.clawdBurnedOnChain}
            lastBurnAt={rescoreBurns!.lastBurnAt}
          />
        </div>
      )}
    </div>
  )
}
