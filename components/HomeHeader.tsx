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
}

export default function HomeHeader({ rescoreBurns }: Props) {
  const isMobile = useIsMobile()
  const showBurn =
    rescoreBurns &&
    (rescoreBurns.count > 0 || rescoreBurns.clawdBurnedOnChain > 0 || rescoreBurns.ethPendingInReceiver > 0)

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '24px',
        flexDirection: isMobile ? 'column' : 'row',
      }}
    >
      <div style={{ flex: isMobile ? '1 1 auto' : '0 0 64%', minWidth: 0 }}>
        <h1
          style={{
            fontSize: isMobile ? '22px' : '30px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '8px',
            lineHeight: 1.2,
          }}
        >
          The Build Report
        </h1>
        <p style={{ fontSize: isMobile ? '14px' : '15px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0, maxWidth: '52ch' }}>
          A plain English look at the repos, scored and sourced.
        </p>
      </div>
      {showBurn && (
        <div
          style={{
            flex: isMobile ? '1 1 auto' : '0 0 33%',
            minWidth: isMobile ? undefined : '220px',
            maxWidth: isMobile ? undefined : '320px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
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
