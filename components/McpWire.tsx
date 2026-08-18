import type { McpWireSnapshot, WireItem } from '@/lib/mcpWire'

const KIND_LABEL: Record<WireItem['kind'], string> = {
  new: 'NEW TOOL',
  revised: 'UPDATED',
  withdrawn: 'SHUT DOWN',
}

function stamp(at: string): string {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} UTC`
}

export default function McpWire({
  wire,
  admin = false,
}: {
  wire: McpWireSnapshot | null
  admin?: boolean
}) {
  if (!admin || !wire) return null

  return (
    <section className="ext-wire" aria-label="MCP registry wire">
      <p className="ext-paper-sectionhead">The Wire</p>
      <p className="ext-wire__intro">
        New tools people published for AI assistants to use, filed since our last edition.
      </p>
      <p className="ext-wire__source">
        MCP REGISTRY — public listings, not verified usage · admin preview
      </p>

      {wire.status === 'failed' ? (
        <p className="ext-wire__closed">Desk closed — source unavailable.</p>
      ) : wire.status === 'partial' && wire.items.length === 0 ? (
        <p className="ext-wire__closed">Partial pull — page safety limit reached before anything printable.</p>
      ) : wire.items.length === 0 ? (
        <p className="ext-wire__closed">No qualifying listings filed by press time.</p>
      ) : (
        <>
          <ul className="ext-wire__list">
            {wire.items.map(item => (
              <li key={`${item.name}-${item.version}`} className="ext-wire__item">
                <span className={`ext-wire__kind ext-wire__kind--${item.kind}`}>
                  {KIND_LABEL[item.kind]}
                </span>
                <span className="ext-wire__name">{item.title || item.name}</span>
                <span className="ext-wire__time">{stamp(item.at)}</span>
                {item.title && <span className="ext-wire__slug">{item.name}</span>}
                <p className="ext-wire__desc">{item.description}</p>
                {item.note && <p className="ext-wire__note">{item.note}</p>}
              </li>
            ))}
          </ul>
          {wire.totalChanges > wire.items.length && (
            <p className="ext-wire__more">
              {wire.totalChanges} changes filed; {wire.items.length} printed.
            </p>
          )}
        </>
      )}
    </section>
  )
}
