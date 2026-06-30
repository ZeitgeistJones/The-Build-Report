        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {[
            {
              title: 'Holder relevance — consumer apps only',
              rows: [
                { label: 'Burn mechanic exists and is live', weight: '50%' },
                { label: 'Revenue or burn path built in', weight: '30%' },
                { label: 'Takes CLAWD out of circulation', weight: '20%' },
              ],
              note:
                'Each component rated low (1) / mid (2) / high (3). Score = (weighted sum ÷ 3) × 100. We score whether the mechanic exists and is live — not how much has actually burned. Consumer apps are scored directly here. Infrastructure and some theoretical repos may show NA at the repo level because no token mechanic is expected; their value shows up in the quality of downstream consumer apps.',
            },
            {
              title: 'Builder integrity — all repos',
              rows: [
                { label: 'Serves stated vision at time of build', weight: '40%' },
                { label: 'Genuine autonomous build', weight: '35%' },
                { label: 'Passes walkaway test', weight: '25%' },
              ],
              note:
                "Repos are scored against clawdbotatg's stated goals at the time they were built. Goals change — a repo is judged against what the stated intent was then, not now. CV burns are not CLAWD burns. Supply lock is not a burn. Both matter but they are different things.",
            },
            {
              title: 'Builder grade — GitHub signals, equally weighted',
              rows: [
                { label: 'Commit frequency', weight: 'equal' },
                { label: 'Active days in period', weight: 'equal' },
                { label: 'New repos created', weight: 'equal' },
                { label: 'Repos with new commits', weight: 'equal' },
                { label: 'Consistency — no long gaps', weight: 'equal' },
              ],
              note:
                'A = 80–100 · B = 60–79 · C = 40–59 · D = below 40. Holder relevance grade measures what proportion of currently active repos are direct, supply lock, or indirect vs infrastructure and theoretical. Integrity grade is the average builder-integrity score of repos active in the selected period. Trend arrow compares the current period to the previous matching window.',
            },
          ].map(block => (
            <div key={block.title} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '10px' }}>
                {block.title}
              </div>
              {block.rows.map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>{row.label}</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {row.weight}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {block.note}
              </div>
            </div>
          ))}
        </div>
