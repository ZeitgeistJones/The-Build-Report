'use client'

import RescoreBurnTracker from '@/components/RescoreBurnTracker'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  rescoreBurns: {
    count: number
    ethPendingInReceiver: number
    clawdBurnedOnChain: number
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
        gap: '16px',
        flexDirection: isMobile ? 'column' : 'row',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: isMobile ? '22px' : '26px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '6px',
          }}
        >
          The Build Report
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          A plain English look at the repos, scored and sourced.
        </p>
      </div>
      {showBurn && (
        <RescoreBurnTracker
          count={rescoreBurns!.count}
          ethPendingInReceiver={rescoreBurns!.ethPendingInReceiver}
          clawdBurnedOnChain={rescoreBurns!.clawdBurnedOnChain}
        />
      )}
    </div>
  )
}
