/**
 * Compact newspaper Wire desk for public /yesterdays-builds + Admin preview.
 */
import { officialRegistryRecordUrl, type McpWireSnapshot } from '@/lib/mcpWire'
import { PUBLIC_WIRE_CAP, toPublicWireDispatch } from '@/lib/mcpWirePublic'

export default function McpWire({
  wire,
  preview = false,
}: {
  wire: McpWireSnapshot | null
  /** Admin-only caption that this is the public desk preview. */
  preview?: boolean
}) {
  const items = (wire?.items ?? []).slice(0, PUBLIC_WIRE_CAP)
  const dispatches = items.map(toPublicWireDispatch)
  const failed = wire?.status === 'failed'
  const quiet = !failed && dispatches.length === 0

  return (
    <section className="ext-wire" aria-label="The Wire">
      {preview && <p className="ext-wire__preview">Admin desk preview · not live</p>}
      <p className="ext-paper-sectionhead">The Wire</p>
      <p className="ext-wire__deck">
        New and changed AI-tool connectors from the official MCP Registry — open the drop links
        below to jump to the listing or source.
      </p>
      <div className="ext-wire__source">
        <span className="ext-wire__source-text">
          Official MCP Registry · public listing activity, not verified usage or endorsement
        </span>
        {' · '}
        <details className="ext-wire__limits">
          <summary>Source &amp; limits</summary>
          <div className="ext-wire__limits-body">
            <p>
              MCP tools are connectors that let AI assistants use outside software, APIs, data, wallets,
              browsers and other services.
            </p>
            <p>
              The Wire watches public changes in the official MCP Registry and turns a small number of
              those Registry events into short newspaper dispatches.
            </p>
            <p>
              The Wire is an independent automated digest of public Registry metadata.
            </p>
            <p>
              A Registry listing does not mean The Build Report has verified that a tool is safe,
              reliable, widely used, endorsed, or works exactly as described.
            </p>
            <p>
              Registry status changes describe the listing in the MCP Registry. For example, ‘Removed
              from Registry’ does not necessarily mean the underlying project shut down or stopped
              working.
            </p>
            <p>
              Descriptions and project metadata may come from the publisher’s Registry listing. Where
              available, separate links are provided to the project’s public source repository.
            </p>
            <p>
              The Build Report is not affiliated with or endorsed by the MCP Registry or the projects
              listed here. Inclusion is not an endorsement, security review, usage claim, or
              recommendation.
            </p>
          </div>
        </details>
      </div>

      <div className="ext-paper-rule" />

      {failed ? (
        <p className="ext-wire__quiet">Desk closed — Registry source unavailable.</p>
      ) : quiet ? (
        <p className="ext-wire__quiet">No notable Registry changes filed overnight.</p>
      ) : (
        <ul className="ext-wire__list">
          {dispatches.map(item => {
            const registryHref = officialRegistryRecordUrl(item.name, item.version)
            const dropHref = item.repoUrl || registryHref
            const isNewDrop = item.status === 'NEW'
            const label = item.beat ? `${item.status} · ${item.beat}` : item.status
            return (
              <li
                key={`${item.name}-${item.version}`}
                className={isNewDrop ? 'ext-wire__item ext-wire__item--new' : 'ext-wire__item'}
              >
                <div className="ext-wire__meta">
                  <span className="ext-wire__kicker">{label}</span>
                  {item.time && <time className="ext-wire__time">{item.time}</time>}
                </div>
                <h3 className="ext-wire__title">
                  <a
                    href={dropHref}
                    target="_blank"
                    rel="noreferrer"
                    className="ext-wire__title-link"
                    aria-label={`Open ${item.title} drop`}
                  >
                    {item.title}
                  </a>
                </h3>
                {item.trackedNote && <p className="ext-wire__desk">Also covered above</p>}
                <p className="ext-wire__sentence">{item.sentence}</p>
                {item.deletionNote && (
                  <p className="ext-wire__note">
                    Registry removal does not necessarily mean the underlying project shut down.
                  </p>
                )}
                <p className="ext-wire__receipts">
                  {isNewDrop && (
                    <a
                      href={dropHref}
                      target="_blank"
                      rel="noreferrer"
                      className="ext-wire__drop-link"
                      aria-label={`Open new drop: ${item.title}`}
                    >
                      Open drop ↗
                    </a>
                  )}
                  <a
                    href={registryHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${item.title} in the official MCP Registry`}
                  >
                    Registry ↗
                  </a>
                  {item.repoUrl && (
                    <a
                      href={item.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View ${item.title} source repository`}
                    >
                      Source ↗
                    </a>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
