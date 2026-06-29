'use client'

interface Props {
  totalRepos: number
  totalCommitsAllTime: number
  activeDaysAllTime: number
  firstCommitAt: string | null
  lastCommitAt: string | null
  lastCommitRepo: string | null
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / 86400000)
}

export default function AllTimeStats({ totalRepos, totalCommitsAllTime, activeDaysAllTime, firstCommitAt, lastCommitAt, lastCommitRepo }: Props) {
  const days = daysSince(firstCommitAt)

  const stats = [
    { label: 'Total repos', value: totalRepos.toString(), sub: 'public on GitHub' },
    { label: 'Commits tracked', value: totalCommitsAllTime.toLocaleString(), sub: 'since Jan 25, 2026' },
    { label: 'Active days', value: activeDaysAllTime.toString(), sub: `of ${days} days` },
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

function formatLastCommit(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
