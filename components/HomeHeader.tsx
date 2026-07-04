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
}

export default function HomeHeader({ rescoreBurns, latestCommitLabel }: Props) {
  const isMobile = useIsMobile()
  const showBurn =
    rescoreBurns &&
    (rescoreBurns.count > 0 || rescoreBurns.clawdBurnedOnChain > 0 || rescoreBurns.ethPendingInReceiver > 0)

  return (
    <div style={{ position: 'relative', marginBottom: '8px', paddingRight: showBurn && !isMobile ? '180px' : 0 }}>
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
      </p>

      {showBurn && (
        <div
          style={{
            position: isMobile ? 'relative' : 'absolute',
            top: isMobile ? undefined : 0,
            right: isMobile ? undefined : 0,
            marginTop: isMobile ? '12px' : 0,
            ...(isMobile ? { display: 'flex', justifyContent: 'flex-start' } : {}),
          }}
        >
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
