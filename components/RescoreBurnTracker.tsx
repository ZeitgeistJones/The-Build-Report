import { formatBurnedEth } from '@/lib/rescoreBurns'

interface Props {
  count: number
  ethTotal: number
}

export default function RescoreBurnTracker({ count, ethTotal }: Props) {
  if (count <= 0) return null

  const ethLabel = formatBurnedEth(ethTotal)

  return (
    <p
      style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        marginBottom: '12px',
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{count}</span>
      {' rescores powered by $CLAWD burns · '}
      <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{ethLabel}</span>
      {' ETH burned'}
    </p>
  )
}
