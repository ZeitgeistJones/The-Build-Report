'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import {
  X_CHAR_LIMIT,
  composeBriefPost,
  composeNeedlePost,
  splitIntoThread,
  xIntentUrl,
  xWeightedLength,
  type ShareBriefSource,
  type ShareNeedleSource,
  type ShareVoice,
} from '@/lib/xSharePosts'

type Props = {
  password: string
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export default function AdminXShareTool({ password }: Props) {
  const [voice, setVoice] = useState<ShareVoice>('standard')
  const [includeLink, setIncludeLink] = useState(true)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [briefSource, setBriefSource] = useState<ShareBriefSource | null>(null)
  const [needleSource, setNeedleSource] = useState<ShareNeedleSource | null>(null)
  const [briefText, setBriefText] = useState('')
  const [needleText, setNeedleText] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [threadPreview, setThreadPreview] = useState<{ kind: 'brief' | 'needle'; parts: string[] } | null>(
    null,
  )

  async function loadPosts() {
    setLoadState('loading')
    setError(null)
    setThreadPreview(null)
    try {
      const res = await fetch('/api/admin/share-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!data.ok) {
        setLoadState('error')
        setError(data.error ?? 'Failed to load posts')
        return
      }
      const brief = data.brief as ShareBriefSource | null
      const needle = data.needle as ShareNeedleSource | null
      setBriefSource(brief)
      setNeedleSource(needle)
      setBriefText(brief ? composeBriefPost(brief, voice, { includeLink }) : '')
      setNeedleText(needle ? composeNeedlePost(needle, voice, { includeLink }) : '')
      setLoadState('ready')
    } catch {
      setLoadState('error')
      setError('Share posts request failed')
    }
  }

  function recompose(nextVoice: ShareVoice, nextLink: boolean) {
    setVoice(nextVoice)
    setIncludeLink(nextLink)
    setThreadPreview(null)
    if (briefSource) setBriefText(composeBriefPost(briefSource, nextVoice, { includeLink: nextLink }))
    if (needleSource) setNeedleText(composeNeedlePost(needleSource, nextVoice, { includeLink: nextLink }))
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  function openOnX(text: string) {
    window.open(xIntentUrl(text), '_blank', 'noopener,noreferrer')
  }

  const panelStyle = {
    marginBottom: '12px',
    padding: '12px 14px',
    background: 'var(--surface-1)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  } as const

  const btnStyle = {
    fontSize: '12px',
    padding: '7px 12px',
    borderRadius: 'var(--radius)',
    background: 'var(--surface-3)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-strong)',
    cursor: 'pointer' as const,
  }

  const accentBtn = {
    ...btnStyle,
    background: 'var(--accent)',
    color: 'var(--accent-contrast, #fff)',
    border: '1px solid var(--accent)',
  }

  return (
    <div style={{ marginBottom: '32px' }}>
      <div
        style={{
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Share on X</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px' }}>
            Compose posts from the cached Yesterday&apos;s build and The Needle. Edit before posting —
            briefs often need a trim or a thread.
          </p>
        </div>
        <button onClick={loadPosts} disabled={loadState === 'loading'} style={btnStyle}>
          {loadState === 'loading' ? 'Loading…' : loadState === 'ready' ? 'Reload posts' : 'Load posts'}
        </button>
      </div>

      {error && (
        <div style={{ ...panelStyle, color: 'var(--danger, #b33)' }}>{error}</div>
      )}

      {loadState === 'ready' && (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              marginBottom: '14px',
              fontSize: '13px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Voice
              <select
                value={voice}
                onChange={e => recompose(e.target.value as ShareVoice, includeLink)}
                style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="standard">Standard</option>
                <option value="normie">Normie</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="checkbox"
                checked={includeLink}
                onChange={e => recompose(voice, e.target.checked)}
              />
              Include site link
            </label>
            {copied && (
              <span style={{ color: 'var(--accent)', fontSize: '12px' }}>Copied {copied}</span>
            )}
          </div>

          <ShareDraft
            title="Yesterday's build"
            meta={
              briefSource
                ? `${briefSource.dateKey} · ${briefSource.repoCount} repos · ${briefSource.commitCount} commits`
                : null
            }
            emptyLabel="No build brief cached yet — regenerate it above first."
            text={briefText}
            onChange={setBriefText}
            onCopy={() => copyText('brief', briefText)}
            onPost={() => openOnX(briefText)}
            onThread={() => setThreadPreview({ kind: 'brief', parts: splitIntoThread(briefText) })}
            panelStyle={panelStyle}
            btnStyle={btnStyle}
            accentBtn={accentBtn}
            hasSource={Boolean(briefSource)}
          />

          <ShareDraft
            title="The Needle"
            meta={
              needleSource
                ? `${needleSource.dateKey} · ${needleSource.repoCount} repos moved`
                : null
            }
            emptyLabel="No Needle cached yet — regenerate it above first."
            text={needleText}
            onChange={setNeedleText}
            onCopy={() => copyText('needle', needleText)}
            onPost={() => openOnX(needleText)}
            onThread={() => setThreadPreview({ kind: 'needle', parts: splitIntoThread(needleText) })}
            panelStyle={panelStyle}
            btnStyle={btnStyle}
            accentBtn={accentBtn}
            hasSource={Boolean(needleSource)}
          />

          {threadPreview && threadPreview.parts.length > 0 && (
            <div style={panelStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ fontSize: '13px' }}>
                  Thread preview — {threadPreview.kind === 'brief' ? "Yesterday's build" : 'The Needle'}{' '}
                  ({threadPreview.parts.length} posts)
                </strong>
                <button type="button" style={btnStyle} onClick={() => setThreadPreview(null)}>
                  Close
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {threadPreview.parts.map((part, i) => (
                  <ThreadPart
                    key={i}
                    index={i}
                    text={part}
                    btnStyle={btnStyle}
                    accentBtn={accentBtn}
                    onCopy={() => copyText(`thread ${i + 1}`, part)}
                    onPost={() => openOnX(part)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ShareDraft({
  title,
  meta,
  emptyLabel,
  text,
  onChange,
  onCopy,
  onPost,
  onThread,
  panelStyle,
  btnStyle,
  accentBtn,
  hasSource,
}: {
  title: string
  meta: string | null
  emptyLabel: string
  text: string
  onChange: (v: string) => void
  onCopy: () => void
  onPost: () => void
  onThread: () => void
  panelStyle: CSSProperties
  btnStyle: CSSProperties
  accentBtn: CSSProperties
  hasSource: boolean
}) {
  const len = useMemo(() => xWeightedLength(text), [text])
  const over = len > X_CHAR_LIMIT

  if (!hasSource) {
    return (
      <div style={{ ...panelStyle, color: 'var(--text-muted)', fontSize: '13px' }}>
        <strong style={{ color: 'var(--text-secondary)' }}>{title}</strong>
        <div style={{ marginTop: '6px' }}>{emptyLabel}</div>
      </div>
    )
  }

  return (
    <div style={{ ...panelStyle, marginBottom: '16px' }}>
      <div style={{ marginBottom: '8px' }}>
        <strong style={{ fontSize: '13px' }}>{title}</strong>
        {meta && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{meta}</div>
        )}
      </div>
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        rows={8}
        style={{
          width: '100%',
          fontSize: '13px',
          lineHeight: 1.45,
          padding: '10px 12px',
          borderRadius: 'var(--radius)',
          border: `1px solid ${over ? 'var(--danger, #b33)' : 'var(--border)'}`,
          background: 'var(--surface-0, var(--bg))',
          color: 'var(--text-primary)',
          resize: 'vertical',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          marginTop: '8px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: over ? 'var(--danger, #b33)' : 'var(--text-muted)',
            marginRight: 'auto',
          }}
        >
          {len}/{X_CHAR_LIMIT}
          {over ? ' — over limit (trim or make a thread)' : ''}
        </span>
        <button type="button" style={btnStyle} onClick={onCopy}>
          Copy
        </button>
        <button type="button" style={btnStyle} onClick={onThread}>
          Make thread
        </button>
        <button type="button" style={accentBtn} onClick={onPost}>
          Post on X
        </button>
      </div>
    </div>
  )
}

function ThreadPart({
  index,
  text,
  btnStyle,
  accentBtn,
  onCopy,
  onPost,
}: {
  index: number
  text: string
  btnStyle: CSSProperties
  accentBtn: CSSProperties
  onCopy: () => void
  onPost: () => void
}) {
  const len = xWeightedLength(text)
  const over = len > X_CHAR_LIMIT
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--surface-0, var(--bg))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: over ? 'var(--danger, #b33)' : 'var(--text-muted)',
          marginBottom: '6px',
        }}
      >
        Post {index + 1} · {len}/{X_CHAR_LIMIT}
      </div>
      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          fontSize: '13px',
          lineHeight: 1.45,
          color: 'var(--text-primary)',
        }}
      >
        {text}
      </pre>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button type="button" style={btnStyle} onClick={onCopy}>
          Copy
        </button>
        <button type="button" style={accentBtn} onClick={onPost}>
          Post on X
        </button>
      </div>
    </div>
  )
}
