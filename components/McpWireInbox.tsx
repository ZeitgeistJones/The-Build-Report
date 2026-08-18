import type { McpWireAdminRecord, McpWireStatus, WireInboxRow, WirePile } from '@/lib/mcpWire'
import { WHY_SHOWN_LABEL, type WireWhyCode } from '@/lib/mcpWireSignals'

const KIND_HAPPENED: Record<WireInboxRow['kind'], string> = {
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

function pileOf(row: WireInboxRow): WirePile {
  return row.pile ?? (row.keep ? 'routine' : 'filtered')
}

function reasonLine(code: WireWhyCode, count: number) {
  const labels: Record<WireWhyCode, string> = {
    tracked: 'tracked-project matches',
    newTool: 'new tools',
    crypto: 'crypto/onchain tools',
    realCode: 'with public source repos',
    withdrawn: 'withdrawals',
    majorChange: 'major capability changes',
    consequential: 'consequential-access tools',
    firstRelease: 'first/major releases',
  }
  return `${count} ${labels[code]}`
}

function InboxCard({ row }: { row: WireInboxRow }) {
  const pile = pileOf(row)
  const why = row.whyShown ?? []

  return (
    <li className="wire-card">
      {pile === 'show' && why.length > 0 && (
        <div className="wire-card__labels">
          {why.map(code => (
            <span key={code} className="wire-card__label">
              {WHY_SHOWN_LABEL[code]}
            </span>
          ))}
        </div>
      )}
      {pile === 'filtered' && (
        <span className="wire-inbox__keep is-skip">SKIP</span>
      )}
      <p className="wire-card__title">{row.title || row.name}</p>
      <p className="wire-card__what">
        <strong>What it is:</strong> {row.whatItIs || row.description || '—'}
      </p>
      <p className="wire-card__what">
        <strong>What happened:</strong> {row.whatHappened || KIND_HAPPENED[row.kind]}
      </p>
      <p className="wire-card__why">
        <strong>{pile === 'filtered' ? 'Why skipped:' : 'Why shown:'}</strong>{' '}
        {row.whyShownText || row.reason}
      </p>
      {row.tracked && (
        <p className="wire-card__tracked">
          Tracked as: {row.tracked.label}{' '}
          <a href={row.tracked.buildsHref}>Yesterday’s Builds ↗</a>
        </p>
      )}
      <details className="wire-card__tech">
        <summary>Technical details</summary>
        <div className="wire-inbox__meta">
          <span>{row.name}</span>
          {row.version && <span>v{row.version}</span>}
          <span>{fmtTime(row.at)}</span>
          {row.publisher && <span>publisher: {row.publisher}</span>}
          {row.repoUrl && (
            <a href={row.repoUrl} target="_blank" rel="noreferrer">
              {row.repoUrl}
            </a>
          )}
        </div>
      </details>
    </li>
  )
}

function Pile({
  title,
  count,
  stored,
  defaultOpen,
  note,
  rows,
}: {
  title: string
  count: number
  stored: number
  defaultOpen?: boolean
  note?: string
  rows: WireInboxRow[]
}) {
  return (
    <details className="wire-pile" open={defaultOpen}>
      <summary>
        {title} — {count}
        {stored < count ? ` (showing ${stored})` : ''}
      </summary>
      {note && <p className="wire-pile__note">{note}</p>}
      {rows.length === 0 ? (
        <p className="wire-inbox__empty">None in this collection.</p>
      ) : (
        <ul className="wire-inbox__list">
          {rows.map((row, i) => (
            <InboxCard key={`${row.name}-${row.version}-${i}`} row={row} />
          ))}
        </ul>
      )}
    </details>
  )
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
  const showMe = record.showMeCount ?? 0
  const routine = record.routineCount ?? 0
  const filtered = record.filteredCount ?? record.skippedFilterCount + record.skippedOtherCount
  const showRows = record.inbox.filter(r => pileOf(r) === 'show')
  const routineRows = record.inbox.filter(r => pileOf(r) === 'routine')
  const filteredRows = record.inbox.filter(r => pileOf(r) === 'filtered')
  const reasonEntries = Object.entries(record.reasonCounts ?? {}) as [WireWhyCode, number][]

  return (
    <div className="wire-inbox">
      <p className="wire-inbox__explain">
        MCP tools are connectors that let AI assistants use outside services, APIs, data, software,
        wallets, browsers, databases, and other systems. The Wire watches the public MCP Registry for
        new or changed connectors from projects across the wider ecosystem.
      </p>
      <p className="wire-inbox__explain wire-inbox__explain--desk">
        You should not need to read the whole firehose. SHOW ME is the short list. Routine updates and
        filtered noise stay collapsed.
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
          <dt>Surfaced events</dt>
          <dd>{showMe}</dd>
        </div>
        <div>
          <dt>Routine updates</dt>
          <dd>{routine}</dd>
        </div>
        <div>
          <dt>Filtered / noise</dt>
          <dd>{filtered}</dd>
        </div>
        <div>
          <dt>Pages fetched</dt>
          <dd>
            {record.pagesFetched} / {record.pageCap} max
            {record.paginationComplete ? ' · reached the end' : ' · stopped at safety cap'}
          </dd>
        </div>
        <div>
          <dt>Checking since</dt>
          <dd>{record.since || '—'}</dd>
        </div>
        <div>
          <dt>Collection time</dt>
          <dd>{fmtTime(record.snapshot.collectedAt)}</dd>
        </div>
        <div>
          <dt>Watermark</dt>
          <dd>
            {record.watermarkAdvanced
              ? `Advanced to ${record.snapshot.through || '—'}`
              : `NOT advanced (still ${record.snapshot.through || 'none'})`}
          </dd>
        </div>
      </dl>

      {record.snapshot.error && <p className="wire-inbox__error">{record.snapshot.error}</p>}

      <p className="wire-inbox__counts">
        {record.consideredCount} registry changes
        {record.inboxCapped ? ' · some piles are capped in storage (counts above are complete)' : ''}
      </p>

      {reasonEntries.length > 0 && (
        <ul className="wire-inbox__reason-counts">
          {reasonEntries
            .filter(([, n]) => n > 0)
            .map(([code, n]) => (
              <li key={code}>{reasonLine(code, n)}</li>
            ))}
          <li className="wire-inbox__overlap">SHOW ME labels can overlap on one listing.</li>
        </ul>
      )}

      <Pile
        title="SHOW ME"
        count={showMe}
        stored={record.showStored ?? showRows.length}
        defaultOpen
        note="Concrete events with a factual reason to look."
        rows={showRows}
      />
      <Pile
        title="ROUTINE UPDATES"
        count={routine}
        stored={record.routineStored ?? routineRows.length}
        note="Existing listings that changed in a low-value way (version bump, metadata, no obvious new capability)."
        rows={routineRows}
      />
      <Pile
        title="FILTERED / NOISE"
        count={filtered}
        stored={record.filteredStored ?? filteredRows.length}
        note="Excluded by the current low-interest filter (marketing, casino/betting, crypto/trading signals) or missing listing metadata."
        rows={filteredRows}
      />
    </div>
  )
}
