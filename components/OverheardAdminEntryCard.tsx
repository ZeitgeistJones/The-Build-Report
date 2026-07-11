'use client'

import type { OverheardEntry, OverheardQuote } from '@/lib/podcastMentions'
import { filterValidQuotes } from '@/components/OverheardCard'

export type MentionEditDraft = {
  writeup: string
  repoSlug: string
  userContext: string
  quotes: OverheardQuote[]
}

export function sanitizeDraftForSave(draft: MentionEditDraft): MentionEditDraft {
  const quotes = filterValidQuotes(
    draft.quotes.map(q => ({
      ...q,
      speaker: q.speaker.trim(),
      text: q.text.trim(),
    })),
  )
  return { ...draft, quotes }
}

export function mentionToEditDraft(entry: OverheardEntry): MentionEditDraft {
  const quotes = filterValidQuotes(entry.quotes.map(q => ({ ...q })))
  return {
    writeup: entry.writeup,
    repoSlug: entry.repoSlug,
    userContext: entry.userContext ?? '',
    quotes: quotes.length ? quotes : entry.quotes.slice(0, 1).map(q => ({ ...q })),
  }
}

export function writeupPreview(text: string, max = 140): string {
  const trimmed = text.trim()
  if (!trimmed) return '(no writeup)'
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function formatMentionTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
}

type Props = {
  entry: OverheardEntry
  editing: boolean
  draft: MentionEditDraft
  busyKey: string | null
  onDraftChange: (draft: MentionEditDraft) => void
  onToggleEdit: () => void
  onSave: () => void
  onTakeDown?: () => void
  onRemoveFromArchives?: () => void
  onMoveToPending?: () => void
  onPublish?: () => void
  onDismiss?: () => void
  onRegenerateWriteup?: () => void
  showPublish?: boolean
  showDismiss?: boolean
  showRegenerate?: boolean
}

export default function OverheardAdminEntryCard({
  entry,
  editing,
  draft,
  busyKey,
  onDraftChange,
  onToggleEdit,
  onSave,
  onTakeDown,
  onRemoveFromArchives,
  onMoveToPending,
  onPublish,
  onDismiss,
  onRegenerateWriteup,
  showPublish = false,
  showDismiss = false,
  showRegenerate = false,
}: Props) {
  const isBusy = busyKey === entry.id || busyKey === `save:${entry.id}` || busyKey === `regen:${entry.id}`

  function updateQuote(index: number, patch: Partial<OverheardQuote>) {
    onDraftChange({
      ...draft,
      quotes: draft.quotes.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    })
  }

  function removeQuote(index: number) {
    if (draft.quotes.length <= 1) return
    onDraftChange({
      ...draft,
      quotes: draft.quotes.filter((_, i) => i !== index),
    })
  }

  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
        <strong style={{ color: 'var(--text-primary)' }}>{entry.repoSlug}</strong>
        {entry.kind === 'thread' ? ` · thread (${entry.quotes.length} quotes)` : ''} · {entry.episodeName}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.45 }}>
        Status: {entry.status}
        {entry.publishedAt ? ` · published ${formatMentionTime(entry.publishedAt)}` : ''}
        {entry.confirmedAt ? ` · confirmed ${formatMentionTime(entry.confirmedAt)}` : ''}
        {entry.scannedAt ? ` · scanned ${formatMentionTime(entry.scannedAt)}` : ''}
      </div>
      {entry.episodeUrl && (
        <a
          href={entry.episodeUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }}
        >
          Episode link ↗
        </a>
      )}

      {!editing ? (
        <>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 10px' }}>
            {writeupPreview(entry.writeup)}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {filterValidQuotes(entry.quotes).slice(0, 2).map((q, i) => (
              <div key={`${entry.id}-preview-${i}`} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{q.speaker}: </span>
                &ldquo;{q.text.length > 120 ? `${q.text.slice(0, 120)}…` : q.text}&rdquo;
              </div>
            ))}
            {filterValidQuotes(entry.quotes).length > 2 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{filterValidQuotes(entry.quotes).length - 2} more quote(s)</span>
            )}
          </div>
        </>
      ) : (
        <>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Repo slug</label>
          <input
            value={draft.repoSlug}
            onChange={e => onDraftChange({ ...draft, repoSlug: e.target.value })}
            style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', marginBottom: '10px' }}
          />
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Writeup</label>
          <textarea
            value={draft.writeup}
            onChange={e => onDraftChange({ ...draft, writeup: e.target.value })}
            rows={4}
            style={{ ...fieldStyle, resize: 'vertical', marginBottom: '10px', lineHeight: 1.55 }}
          />
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Context (optional)</label>
          <textarea
            value={draft.userContext}
            onChange={e => onDraftChange({ ...draft, userContext: e.target.value })}
            rows={2}
            placeholder="Optional context…"
            style={{ ...fieldStyle, resize: 'vertical', marginBottom: '10px' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
            {draft.quotes.map((q, i) => (
              <div key={`${entry.id}-edit-${i}`} style={{ padding: '8px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <input
                  value={q.speaker}
                  onChange={e => updateQuote(i, { speaker: e.target.value })}
                  placeholder="Speaker"
                  style={{ ...fieldStyle, marginBottom: '6px', fontSize: '12px' }}
                />
                <textarea
                  value={q.text}
                  onChange={e => updateQuote(i, { text: e.target.value })}
                  placeholder="Quote text"
                  rows={2}
                  style={{ ...fieldStyle, resize: 'vertical', fontSize: '12px', lineHeight: 1.5 }}
                />
                {draft.quotes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuote(i)}
                    style={{ marginTop: '6px', fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    Remove quote
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onToggleEdit}
          disabled={isBusy}
          style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          {editing ? 'Close editor' : 'Edit'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onSave}
            disabled={busyKey === `save:${entry.id}`}
            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {busyKey === `save:${entry.id}` ? 'Saving…' : 'Save changes'}
          </button>
        )}
        {showRegenerate && onRegenerateWriteup && (
          <button
            type="button"
            onClick={onRegenerateWriteup}
            disabled={busyKey === `regen:${entry.id}`}
            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {busyKey === `regen:${entry.id}` ? 'Regenerating…' : 'Regenerate writeup'}
          </button>
        )}
        {onTakeDown && (
          <button
            type="button"
            onClick={onTakeDown}
            disabled={isBusy}
            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-3)', color: 'var(--red, #c44)', border: '1px solid var(--border)' }}
          >
            Take down
          </button>
        )}
        {onRemoveFromArchives && (
          <button
            type="button"
            onClick={onRemoveFromArchives}
            disabled={isBusy}
            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-3)', color: 'var(--red, #c44)', border: '1px solid var(--border)' }}
          >
            Take down from archives
          </button>
        )}
        {onMoveToPending && (
          <button
            type="button"
            onClick={onMoveToPending}
            disabled={isBusy}
            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Move to pending
          </button>
        )}
        {showPublish && onPublish && (
          <button
            type="button"
            onClick={onPublish}
            disabled={isBusy}
            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '99px', border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 500 }}
          >
            {isBusy ? 'Publishing…' : 'Publish'}
          </button>
        )}
        {showDismiss && onDismiss && !entry.publishedAt && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={isBusy}
            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '99px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
