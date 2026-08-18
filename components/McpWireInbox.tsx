import type { McpWireAdminRecord, McpWireStatus, WireInboxRow } from '@/lib/mcpWire'

const KIND_LABEL: Record<WireInboxRow['kind'], string> = {
  new: 'NEW',
  revised: 'UPDATED',
  withdrawn: 'WITHDRAWN',
  unknown: '—',
}

function statusLabel(status: McpWireStatus): 'COMPLETE' | 'PARTIAL' | 'FAILED' {
  if (status === 'ok') return 'COMPLETE'
  if (status === 'partial') return 'PARTIAL'
  return 'FAILED'
}

function fmtTime(at: string): string {
  if (!at) return '—'
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
}

function fmtCollected(at: string): string {
  if (!at) return '—'
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
}

export default function McpWireInbox({ record }: { record: McpWireAdminRecord | null }) {
  if (!record) {
    return (
      <p className="wire-inbox__empty">
        No collection on file yet. Click Refresh wire — nothing prints until the collector runs.
      </p>
    )
  }

  const status = statusLabel(record.snapshot.status)
  const skipped = record.skippedFilterCount + record.skippedOtherCount

  return (
    <div className="wire-inbox">
      <p className="wire-inbox__explain">
        MCP tools are connectors that let AI assistants use outside services, APIs, data, or software.
        The Wire watches the public MCP Registry for new or changed connectors from projects across the
        wider ecosystem.
      </p>
      <p className="wire-inbox__explain wire-inbox__explain--desk">
        This inbox is the mailroom: everything the registry sent us, then what the robot editor kept or
        threw away. The newspaper preview below is only the kept items that would print.
      </p>

      <dl className="wire-inbox__summary">
        <div>
          <dt>Collection status</dt>
          <dd className={`wire-inbox__status wire-inbox__status--${record.snapshot.status}`}>{status}</dd>
        </div>
        <div>
          <dt>Raw registry changes found</dt>
          <dd>{record.rawRegistryRows}</dd>
        </div>
        <div>
          <dt>Kept as potentially interesting</dt>
          <dd>{record.keptCount}</dd>
        </div>
        <div>
          <dt>Skipped by our filter</dt>
          <dd>{record.skippedFilterCount}</dd>
        </div>
        <div>
          <dt>Printed in the newspaper preview</dt>
          <dd>{record.printedCount}</dd>
        </div>
        <div>
          <dt>Pages fetched</dt>
          <dd>
            {record.pagesFetched} / {record.pageCap} max
            {record.paginationComplete ? ' · reached the end' : ' · stopped at safety cap'}
          </dd>
        </div>
        <div>
          <dt>Window start</dt>
          <dd>Checking since {record.since || '—'}</dd>
        </div>
        <div>
          <dt>Collection time</dt>
          <dd>{fmtCollected(record.snapshot.collectedAt)}</dd>
        </div>
        <div>
          <dt>Watermark</dt>
          <dd>
            {record.watermarkAdvanced
              ? `Advanced to ${record.snapshot.through || '—'}`
              : `NOT advanced (still ${record.snapshot.through || 'none'})`}
          </dd>
        </div>
        {record.skippedOtherCount > 0 && (
          <div>
            <dt>Skipped for other reasons</dt>
            <dd>{record.skippedOtherCount} (no description or missing listing metadata)</dd>
          </div>
        )}
      </dl>

      {record.snapshot.error && (
        <p className="wire-inbox__error">{record.snapshot.error}</p>
      )}

      <p className="wire-inbox__counts">
        {record.consideredCount} listings considered · {record.keptCount} kept · {skipped} skipped
        {record.inboxCapped
          ? ` · showing ${record.inbox.length} of ${record.inboxTotal} (inbox cap ${record.inboxCap})`
          : ''}
      </p>

      {record.inbox.length === 0 ? (
        <p className="wire-inbox__empty">No listings in this window.</p>
      ) : (
        <ul className="wire-inbox__list">
          {record.inbox.map((row, i) => (
            <li key={`${row.name}-${row.version}-${i}`} className="wire-inbox__row">
              <div className="wire-inbox__row-top">
                <span className={`wire-inbox__keep ${row.keep ? 'is-keep' : 'is-skip'}`}>
                  {row.keep ? 'KEEP' : 'SKIP'}
                </span>
                <span className="wire-inbox__kind">{KIND_LABEL[row.kind]}</span>
                <span className="wire-inbox__title">{row.title || row.name}</span>
                <span className="wire-inbox__when">{fmtTime(row.at)}</span>
              </div>
              {row.title && <div className="wire-inbox__slug">{row.name}</div>}
              {row.description && <p className="wire-inbox__desc">{row.description}</p>}
              <p className="wire-inbox__reason">Reason: {row.reason}</p>
              <div className="wire-inbox__meta">
                {row.version && <span>v{row.version}</span>}
                {row.repoUrl && (
                  <a href={row.repoUrl} target="_blank" rel="noreferrer">
                    {row.repoUrl}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
