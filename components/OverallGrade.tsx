import { gradeColor } from '@/lib/gradeLetters'
import { OverallGrade as OverallGradeType } from '@/lib/overallGrade'

interface Props {
  overall: OverallGradeType
  summary: string | null
}

export default function OverallGrade({ overall, summary }: Props) {
  return (
    <div
      style={{
        marginTop: '16px',
        marginBottom: '20px',
        padding: '16px 18px',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-elevated)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '6px' }}>
        <span
          style={{
            fontSize: '42px',
            lineHeight: 1,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: gradeColor(overall.letter),
          }}
        >
          {overall.letter}
        </span>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
          }}
        >
          {overall.pct}%
        </span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: summary ? '10px' : 0 }}>
        Based on {overall.reposScored} repos scored
      </div>
      {summary && (
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          {summary}
        </p>
      )}
    </div>
  )
}
