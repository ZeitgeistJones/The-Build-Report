'use client'

interface Props {
  totalRepos: number
  totalCommits30d: number
  activeDays30d: number
  lastCommitAt: string | null
  lastCommitRepo: string | null
}

function formatLastCommit(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function AllTimeStats({ totalRepos, totalCommits30d, activeDays30d, lastCommitAt, lastCommitRepo }: Props) {
  const stats = [
    { label: 'Total repos', value: totalRepos.toString(), sub: 'all public on GitHub' },
    { label: 'Commits', value: totalCommits30d.toLocaleString(), sub: 'last 30 days' },
    { label: 'Active days', value: activeDays30d.toString(), sub: 'last 30 days' },
    {
      label: 'Last commit',
      value: lastCommitAt ? formatLastCommit(lastCommitAt) : '—',
      sub: lastCommitRepo ?? '',
    },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '10px',
      marginBottom: '24px',
    }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {s.label}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
            {s.value}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  )
}
