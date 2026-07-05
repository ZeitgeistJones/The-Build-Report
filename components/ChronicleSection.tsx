import type { ChronicleBannerData } from '@/lib/chronicle'

export default function ChronicleSection({ chronicle }: { chronicle: ChronicleBannerData | null }) {
  if (!chronicle?.lastUpdated && !chronicle?.summary) return null

  return (
    <section id="chronicle" style={{ marginBottom: '28px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
        Chronicle
      </h3>
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 20px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: '6px',
          }}
        >
          <a
            href="https://github.com/clawdbotatg/clawd-chronicle"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            Latest Chronicle update
          </a>
          {chronicle?.lastUpdated && (
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '8px' }}>
              · {chronicle.lastUpdated.label}
            </span>
          )}
        </span>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          {chronicle?.summary ?? chronicle?.lastUpdated?.message ?? 'Scoring context sourced from the builder Chronicle.'}
        </p>
      </div>
    </section>
  )
}
