import type { McpWireAdminRecord, McpWireStatus, WireInboxRow, WirePile } from '@/lib/mcpWire'
import { officialRegistryRecordUrl } from '@/lib/mcpWire'
import {
  githubRepoDisplay,
  parseGithubOwnerRepo,
  registryReasonLine,
  registryStatusDisplay,
  WHY_SHOWN_LABEL,
  type WireWhyCode,
} from '@/lib/mcpWireSignals'

const KIND_HAPPENED: Record<WireInboxRow['kind'], string> = {
  new: 'NEW',
  revised: 'UPDATED',
  withdrawn: 'REMOVED FROM REGISTRY',
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
    newTool: 'new registrations',
    crypto: 'crypto/onchain tools',
    realCode: 'with public source repos',
    withdrawn: 'registry removals/deprecations',
    majorChange: 'major capability changes',
    consequential: 'consequential-access tools',
    firstRelease: 'first/major releases',
  }
  return `${count} ${labels[code]}`
}

function cardLabels(row: WireInboxRow): string[] {
  const why = row.whyShown ?? []
  const status = registryStatusDisplay(row.registryStatus)
  const out: string[] = []
  for (const code of why) {
    if (code === 'withdrawn') {
      out.push(status || WHY_SHOWN_LABEL.withdrawn)
      continue
    }
    out.push(WHY_SHOWN_LABEL[code])
  }
  return out
}

function sameProject(a: WireInboxRow, b: WireInboxRow): boolean {
  const ga = parseGithubOwnerRepo(a.repoUrl)
  const gb = parseGithubOwnerRepo(b.repoUrl)
  if (!ga || !gb) return false
  return ga.owner === gb.owner && ga.repo === gb.repo && a.name !== b.name
}

function InboxCard({
  row,
  related,
}: {
  row: WireInboxRow
  related: boolean
}) {
  const pile = pileOf(row)
  const why = cardLabels(row)
  const repoLabel = githubRepoDisplay(row.repoUrl)
  const registryUrl =
    row.name && row.name !== '(unnamed listing)'
      ? officialRegistryRecordUrl(row.name, row.version)
      : null
  const statusWord = row.registryStatus
  const observed = row.updatedAt || row.publishedAt || row.at
  const deleted = row.registryStatus === 'deleted' || (row.kind === 'withdrawn' && row.registryStatus !== 'deprecated')

  return (
    <li className="wire-card">
      {pile === 'show' && why.length > 0 && (
        <div className="wire-card__labels">
          {why.map(label => (
            <span key={label} className="wire-card__label">
              {label}
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
          <a href={row.tracked.buildsHref}>The Daily Loop ↗</a>
        </p>
      )}
      {related && (
        <p className="wire-card__related">Related listing from the same project</p>
      )}
      {deleted && pile === 'show' && (
        <p className="wire-card__caveat">
          Registry removal does not necessarily mean the underlying project shut down.
        </p>
      )}

      <details className="wire-card__evidence">
        <summary>Source evidence</summary>
        <div className="wire-card__evidence-body">
          <p className="wire-card__evidence-kicker">
            <span title="The public directory this Wire watches for MCP listing changes.">
              Official MCP Registry
            </span>
          </p>
          <p>
            Registry name: {row.name}
            {row.version ? ` · Version: v${row.version}` : ''}
          </p>
          <p>
            Registry status:{' '}
            {statusWord || (row.kind === 'withdrawn' ? 'deleted or deprecated' : 'not supplied')}
            {observed ? ` · Observed: ${fmtTime(observed)}` : ''}
          </p>
          {(row.registryStatus === 'deleted' || row.registryStatus === 'deprecated' || row.kind === 'withdrawn') && (
            <p>Registry message: {registryReasonLine(row.statusMessage)}</p>
          )}
          {registryUrl && (
            <p>
              <a href={registryUrl} target="_blank" rel="noreferrer">
                View official Registry record ↗
              </a>
            </p>
          )}
          <p className="wire-card__evidence-kicker">Project source</p>
          {repoLabel ? (
            <>
              <p>{repoLabel}</p>
              {row.repoUrl && (
                <p>
                  <a href={row.repoUrl} target="_blank" rel="noreferrer">
                    View source repository ↗
                  </a>
                </p>
              )}
            </>
          ) : (
            <p>No public source repository linked on this listing.</p>
          )}
          <p className="wire-card__evidence-note">
            Listing description is publisher-supplied Registry metadata, not an independent review.
          </p>
        </div>
      </details>

      <details className="wire-card__tech">
        <summary>Technical details</summary>
        <div className="wire-inbox__meta">
          <span>{row.name}</span>
          {row.version && <span>v{row.version}</span>}
          {row.publisher && <span>Publisher {row.publisher}</span>}
          {repoLabel && <span>Source code {repoLabel}</span>}
          {row.publishedAt && <span>Published {fmtTime(row.publishedAt)}</span>}
          {row.updatedAt && <span>Updated {fmtTime(row.updatedAt)}</span>}
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
  allRows,
}: {
  title: string
  count: number
  stored: number
  defaultOpen?: boolean
  note?: string
  rows: WireInboxRow[]
  allRows: WireInboxRow[]
}) {
  return (
    <details className="wire-pile" open={defaultOpen}>
      <summary>
        {title} — {count} found
        {stored < count ? ` · ${stored} retained for Admin display` : ''}
      </summary>
      {note && <p className="wire-pile__note">{note}</p>}
      {rows.length === 0 ? (
        <p className="wire-inbox__empty">None in this collection.</p>
      ) : (
        <ul className="wire-inbox__list">
          {rows.map((row, i) => (
            <InboxCard
              key={`${row.name}-${row.version}-${i}`}
              row={row}
              related={allRows.some(other => sameProject(row, other))}
            />
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
  const showRank: Record<WireInboxRow['kind'], number> = {
    new: 0,
    withdrawn: 1,
    revised: 2,
    unknown: 3,
  }
  const showRows = record.inbox
    .filter(r => pileOf(r) === 'show')
    .slice()
    .sort(
      (a, b) =>
        Number(!!b.tracked) - Number(!!a.tracked) ||
        showRank[a.kind] - showRank[b.kind] ||
        (b.at || '').localeCompare(a.at || ''),
    )
  const routineRows = record.inbox.filter(r => pileOf(r) === 'routine')
  const filteredRows = record.inbox.filter(r => pileOf(r) === 'filtered')
  const reasonEntries = Object.entries(record.reasonCounts ?? {}) as [WireWhyCode, number][]
  const extra = record.extraVersionRows ?? Math.max(0, record.rawRegistryRows - record.consideredCount)

  return (
    <div className="wire-inbox">
      <h3 className="wire-inbox__what">What is The Wire?</h3>
      <p className="wire-inbox__explain">
        MCP tools are connectors that let AI assistants use outside software, data, APIs, wallets,
        browsers, and other services.
      </p>
      <p className="wire-inbox__explain">
        The Wire watches the{' '}
        <span
          className="wire-inbox__term"
          title="The public directory this Wire watches for MCP listing changes."
        >
          official MCP Registry
        </span>{' '}
        and highlights new listings, meaningful changes, removals, and other events that may be
        relevant to this newspaper.
      </p>
      <details className="wire-inbox__disclose">
        <summary>Learn more</summary>
        <p>
          The MCP Registry is essentially a public directory of MCP tools. Developers and publishers
          submit information about their tools to the Registry. The Build Report watches changes to
          those public listings and organizes them into a smaller newsroom feed.
        </p>
      </details>

      <p className="wire-inbox__source-line">
        Source:{' '}
        <span
          className="wire-inbox__term"
          title="The public directory this Wire watches for MCP listing changes."
        >
          Official MCP Registry
        </span>
        {' · '}Automated digest of public Registry metadata
      </p>
      <details className="wire-inbox__disclose">
        <summary>Source &amp; limitations</summary>
        <div className="wire-inbox__limits">
          <p>
            <strong>About this data</strong>
          </p>
          <p>
            The Wire is an independent automated digest of public metadata from the official MCP
            Registry.
          </p>
          <p>
            Registry events such as new, deprecated, or deleted describe the status of a listing in
            that Registry. They do not by themselves prove that the underlying project launched,
            shut down, is safe, works as described, has users, or remains available elsewhere.
          </p>
          <p>
            Descriptions, links, publisher information, and other project metadata may originate from
            the listing/publisher. Where available, we link separately to the project&apos;s public
            source repository so you can inspect the underlying project.
          </p>
          <p>
            The Build Report is not affiliated with or endorsed by the MCP Registry or the projects
            listed here. Inclusion is not an endorsement, security review, usage claim, or
            recommendation.
          </p>
          <p>
            The MCP Registry is currently a preview service, so upstream records or API behavior may
            change.
          </p>
        </div>
      </details>
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
          <dt>Raw Registry records received</dt>
          <dd>{record.rawRegistryRows}</dd>
        </div>
        <div>
          <dt>Listings after grouping</dt>
          <dd>{record.consideredCount}</dd>
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
        {record.rawRegistryRows} raw Registry records received · {record.consideredCount} listings
        after grouping by Registry name
        {extra > 0
          ? ` (${extra} extra version row${extra === 1 ? '' : 's'} folded into those listings)`
          : ''}
        {record.inboxCapped
          ? ' · some piles are capped in storage — found counts above are complete; retained counts are on each pile'
          : ''}
        .
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
        allRows={record.inbox}
      />
      <Pile
        title="ROUTINE UPDATES"
        count={routine}
        stored={record.routineStored ?? routineRows.length}
        note="Existing listings that changed in a low-value way (version bump, metadata, no obvious new capability)."
        rows={routineRows}
        allRows={record.inbox}
      />
      <Pile
        title="FILTERED / NOISE"
        count={filtered}
        stored={record.filteredStored ?? filteredRows.length}
        note="Excluded by the current low-interest filter (marketing, casino/betting, crypto/trading signals) or missing listing metadata."
        rows={filteredRows}
        allRows={record.inbox}
      />
    </div>
  )
}
