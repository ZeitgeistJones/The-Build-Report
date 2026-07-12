'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import {
  X_CHAR_LIMIT,
  composeBriefPost,
  composeNeedlePost,
  composeShortCaption,
  formatShareDate,
  splitIntoThread,
  xIntentUrl,
  xWeightedLength,
  type ShareBriefSource,
  type ShareNeedleSource,
  type ShareVoice,
} from '@/lib/xSharePosts'
import {
  canvasToPngBlob,
  copyPngBlob,
  downloadPngBlob,
  renderSharePostCanvas,
  shareImageFilename,
  type ShareImageKind,
} from '@/lib/sharePostImage'

type Props = {
  password: string
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

type VariantBundle = [string, string, string]

export default function AdminXShareTool({ password }: Props) {
  const [includeLink, setIncludeLink] = useState(false)
  const [briefVoice, setBriefVoice] = useState<ShareVoice>('normie')
  const [needleVoice, setNeedleVoice] = useState<ShareVoice>('normie')
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [briefSource, setBriefSource] = useState<ShareBriefSource | null>(null)
  const [needleSource, setNeedleSource] = useState<ShareNeedleSource | null>(null)
  const [briefText, setBriefText] = useState('')
  const [needleText, setNeedleText] = useState('')
  const [briefFull, setBriefFull] = useState<string | null>(null)
  const [needleFull, setNeedleFull] = useState<string | null>(null)
  const [briefVariants, setBriefVariants] = useState<VariantBundle | null>(null)
  const [needleVariants, setNeedleVariants] = useState<VariantBundle | null>(null)
  const [briefVariantIdx, setBriefVariantIdx] = useState(0)
  const [needleVariantIdx, setNeedleVariantIdx] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const [threadPreview, setThreadPreview] = useState<{ kind: 'brief' | 'needle'; parts: string[] } | null>(
    null,
  )
  const [briefPreviewUrl, setBriefPreviewUrl] = useState<string | null>(null)
  const [needlePreviewUrl, setNeedlePreviewUrl] = useState<string | null>(null)
  const [imageBusy, setImageBusy] = useState<string | null>(null)
  const [summarizeBusy, setSummarizeBusy] = useState<ShareImageKind | null>(null)

  function clearBriefShort() {
    setBriefFull(null)
    setBriefVariants(null)
    setBriefVariantIdx(0)
  }

  function clearNeedleShort() {
    setNeedleFull(null)
    setNeedleVariants(null)
    setNeedleVariantIdx(0)
  }

  function applyBrief(source: ShareBriefSource | null, voice: ShareVoice, link: boolean) {
    clearBriefShort()
    setBriefText(source ? composeBriefPost(source, voice, { includeLink: link }) : '')
  }

  function applyNeedle(source: ShareNeedleSource | null, voice: ShareVoice, link: boolean) {
    clearNeedleShort()
    setNeedleText(source ? composeNeedlePost(source, voice, { includeLink: link }) : '')
  }

  function revokePreview(url: string | null) {
    if (url) URL.revokeObjectURL(url)
  }

  async function loadPosts() {
    setLoadState('loading')
    setError(null)
    setThreadPreview(null)
    revokePreview(briefPreviewUrl)
    revokePreview(needlePreviewUrl)
    setBriefPreviewUrl(null)
    setNeedlePreviewUrl(null)
    clearBriefShort()
    clearNeedleShort()
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
      applyBrief(brief, briefVoice, includeLink)
      applyNeedle(needle, needleVoice, includeLink)
      setLoadState('ready')
    } catch {
      setLoadState('error')
      setError('Share posts request failed')
    }
  }

  function setLink(next: boolean) {
    setIncludeLink(next)
    setThreadPreview(null)
    applyBrief(briefSource, briefVoice, next)
    applyNeedle(needleSource, needleVoice, next)
  }

  function changeBriefVoice(next: ShareVoice) {
    setBriefVoice(next)
    setThreadPreview(null)
    applyBrief(briefSource, next, includeLink)
  }

  function changeNeedleVoice(next: ShareVoice) {
    setNeedleVoice(next)
    setThreadPreview(null)
    applyNeedle(needleSource, next, includeLink)
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

  async function summarizeUnder280(kind: ShareImageKind) {
    const text = kind === 'brief' ? briefText : needleText
    if (!text.trim() && !(kind === 'brief' ? briefSource : needleSource)) return
    setSummarizeBusy(kind)
    setError(null)
    try {
      // Stash current full draft so Show full can restore the column compose
      if (kind === 'brief' && briefFull == null && text.trim()) setBriefFull(text)
      if (kind === 'needle' && needleFull == null && text.trim()) setNeedleFull(text)

      const res = await fetch('/api/admin/share-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          kind,
          includeLink,
          voice: kind === 'brief' ? briefVoice : needleVoice,
          dateKey: kind === 'brief' ? briefSource?.dateKey : needleSource?.dateKey,
        }),
      })
      const data = await res.json()
      if (!data.ok || !Array.isArray(data.variants) || data.variants.length < 3) {
        setError(data.error ?? 'Under 280 summarize failed')
        return
      }
      const variants = data.variants.slice(0, 3) as VariantBundle
      if (kind === 'brief') {
        setBriefVariants(variants)
        setBriefVariantIdx(0)
        setBriefText(variants[0]!)
      } else {
        setNeedleVariants(variants)
        setNeedleVariantIdx(0)
        setNeedleText(variants[0]!)
      }
    } catch {
      setError('Under 280 request failed')
    } finally {
      setSummarizeBusy(null)
    }
  }

  function setVariant(kind: ShareImageKind, nextIdx: number) {
    const variants = kind === 'brief' ? briefVariants : needleVariants
    if (!variants) return
    const idx = ((nextIdx % 3) + 3) % 3
    if (kind === 'brief') {
      setBriefVariantIdx(idx)
      setBriefText(variants[idx]!)
    } else {
      setNeedleVariantIdx(idx)
      setNeedleText(variants[idx]!)
    }
  }

  function resetVariant(kind: ShareImageKind) {
    const variants = kind === 'brief' ? briefVariants : needleVariants
    const idx = kind === 'brief' ? briefVariantIdx : needleVariantIdx
    if (!variants) return
    if (kind === 'brief') setBriefText(variants[idx]!)
    else setNeedleText(variants[idx]!)
  }

  function showFull(kind: ShareImageKind) {
    if (kind === 'brief' && briefFull != null) {
      setBriefText(briefFull)
      clearBriefShort()
    }
    if (kind === 'needle' && needleFull != null) {
      setNeedleText(needleFull)
      clearNeedleShort()
    }
  }

  async function buildImageBlob(
    kind: ShareImageKind,
    draftText: string,
    dateKey: string,
    metaLine: string,
  ): Promise<{ blob: Blob; filename: string }> {
    const canvas = renderSharePostCanvas({
      kind,
      title: kind === 'brief' ? "Yesterday's Build" : 'The Needle',
      meta: metaLine,
      draftText,
    })
    const blob = await canvasToPngBlob(canvas)
    return { blob, filename: shareImageFilename(kind, dateKey) }
  }

  async function saveAsImage(kind: ShareImageKind) {
    const source = kind === 'brief' ? briefSource : needleSource
    const text = kind === 'brief' ? briefText : needleText
    if (!source || !text.trim()) return
    setImageBusy(`${kind}-save`)
    try {
      const metaLine =
        kind === 'brief'
          ? `${formatShareDate(source.dateKey)} · ${source.repoCount} repos · ${(source as ShareBriefSource).commitCount} commits`
          : `${formatShareDate(source.dateKey)} · ${source.repoCount} repos moved`
      const { blob, filename } = await buildImageBlob(kind, text, source.dateKey, metaLine)
      downloadPngBlob(blob, filename)
      const url = URL.createObjectURL(blob)
      if (kind === 'brief') {
        revokePreview(briefPreviewUrl)
        setBriefPreviewUrl(url)
      } else {
        revokePreview(needlePreviewUrl)
        setNeedlePreviewUrl(url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build image')
    } finally {
      setImageBusy(null)
    }
  }

  async function copyAsImage(kind: ShareImageKind) {
    const source = kind === 'brief' ? briefSource : needleSource
    const text = kind === 'brief' ? briefText : needleText
    if (!source || !text.trim()) return
    setImageBusy(`${kind}-copy`)
    try {
      const metaLine =
        kind === 'brief'
          ? `${formatShareDate(source.dateKey)} · ${source.repoCount} repos · ${(source as ShareBriefSource).commitCount} commits`
          : `${formatShareDate(source.dateKey)} · ${source.repoCount} repos moved`
      const { blob, filename } = await buildImageBlob(kind, text, source.dateKey, metaLine)
      const ok = await copyPngBlob(blob)
      if (ok) {
        setCopied(`${kind} image`)
        window.setTimeout(() => setCopied(null), 2000)
      } else {
        downloadPngBlob(blob, filename)
        setCopied(`${kind} image downloaded`)
        window.setTimeout(() => setCopied(null), 2500)
      }
      const url = URL.createObjectURL(blob)
      if (kind === 'brief') {
        revokePreview(briefPreviewUrl)
        setBriefPreviewUrl(url)
      } else {
        revokePreview(needlePreviewUrl)
        setNeedlePreviewUrl(url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy image')
    } finally {
      setImageBusy(null)
    }
  }

  /** Under limit → post the draft; over limit → short caption for image attach. */
  function postOnX(kind: ShareImageKind) {
    const source = kind === 'brief' ? briefSource : needleSource
    const text = kind === 'brief' ? briefText : needleText
    if (!source) return
    if (xWeightedLength(text) <= X_CHAR_LIMIT) {
      openOnX(text)
      return
    }
    openOnX(composeShortCaption(kind, source))
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

  const briefHasPlain = Boolean(briefSource?.generalNormie?.trim())
  const needleHasPlain = Boolean(needleSource?.textNormie?.trim())

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
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '580px' }}>
            Compose from cached Yesterday&apos;s Build and The Needle. Defaults to{' '}
            <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Plain English</strong>{' '}
            with no site link.{' '}
            <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Under 280</strong> writes
            three tweet-sized variants (255–280 chars; brief opens with Yesterday:) from the same
            upstream commit/rescore evidence as the homepage columns — not from the column text. Plain
            English uses Middle voice. Full drafts can still{' '}
            <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Save as image</strong> with
            a short caption on Post on X when over the limit.
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
              <input
                type="checkbox"
                checked={includeLink}
                onChange={e => setLink(e.target.checked)}
              />
              Include site link (off by default — saves ~23 chars)
            </label>
            {copied && (
              <span style={{ color: 'var(--accent)', fontSize: '12px' }}>Copied {copied}</span>
            )}
          </div>

          <ShareDraft
            title="Yesterday's Build"
            kind="brief"
            meta={
              briefSource
                ? `${briefSource.dateKey} · ${briefSource.repoCount} repos · ${briefSource.commitCount} commits`
                : null
            }
            emptyLabel="No build brief cached yet — regenerate it above first."
            voice={briefVoice}
            onVoiceChange={changeBriefVoice}
            hasPlainEnglish={briefHasPlain}
            text={briefText}
            onChange={setBriefText}
            onCopyText={() => copyText('brief', briefText)}
            onSaveImage={() => saveAsImage('brief')}
            onCopyImage={() => copyAsImage('brief')}
            onPost={() => postOnX('brief')}
            onThread={() => setThreadPreview({ kind: 'brief', parts: splitIntoThread(briefText) })}
            onUnder280={() => summarizeUnder280('brief')}
            onShowFull={() => showFull('brief')}
            onPrevVariant={() => setVariant('brief', briefVariantIdx - 1)}
            onNextVariant={() => setVariant('brief', briefVariantIdx + 1)}
            onResetVariant={() => resetVariant('brief')}
            hasFull={briefFull != null}
            variantIndex={briefVariants ? briefVariantIdx : null}
            summarizeBusy={summarizeBusy === 'brief'}
            imageBusy={imageBusy}
            previewUrl={briefPreviewUrl}
            panelStyle={panelStyle}
            btnStyle={btnStyle}
            accentBtn={accentBtn}
            hasSource={Boolean(briefSource)}
          />

          <ShareDraft
            title="The Needle"
            kind="needle"
            meta={
              needleSource
                ? `${needleSource.dateKey} · ${needleSource.repoCount} repos moved`
                : null
            }
            emptyLabel="No Needle cached yet — regenerate it above first."
            voice={needleVoice}
            onVoiceChange={changeNeedleVoice}
            hasPlainEnglish={needleHasPlain}
            text={needleText}
            onChange={setNeedleText}
            onCopyText={() => copyText('needle', needleText)}
            onSaveImage={() => saveAsImage('needle')}
            onCopyImage={() => copyAsImage('needle')}
            onPost={() => postOnX('needle')}
            onThread={() => setThreadPreview({ kind: 'needle', parts: splitIntoThread(needleText) })}
            onUnder280={() => summarizeUnder280('needle')}
            onShowFull={() => showFull('needle')}
            onPrevVariant={() => setVariant('needle', needleVariantIdx - 1)}
            onNextVariant={() => setVariant('needle', needleVariantIdx + 1)}
            onResetVariant={() => resetVariant('needle')}
            hasFull={needleFull != null}
            variantIndex={needleVariants ? needleVariantIdx : null}
            summarizeBusy={summarizeBusy === 'needle'}
            imageBusy={imageBusy}
            previewUrl={needlePreviewUrl}
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
                  Thread preview — {threadPreview.kind === 'brief' ? "Yesterday's Build" : 'The Needle'}{' '}
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

function VoiceToggle({
  value,
  onChange,
  hasPlainEnglish,
  btnStyle,
}: {
  value: ShareVoice
  onChange: (v: ShareVoice) => void
  hasPlainEnglish: boolean
  btnStyle: CSSProperties
}) {
  const active = (on: boolean): CSSProperties => ({
    ...btnStyle,
    background: on ? 'var(--accent)' : 'var(--surface-3)',
    color: on ? 'var(--accent-contrast, #fff)' : 'var(--text-primary)',
    border: on ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>Version</span>
        <button
          type="button"
          style={active(value === 'standard')}
          onClick={() => onChange('standard')}
        >
          Regular
        </button>
        <button
          type="button"
          style={{
            ...active(value === 'normie'),
            opacity: hasPlainEnglish ? 1 : 0.55,
          }}
          onClick={() => onChange('normie')}
          title={
            hasPlainEnglish
              ? 'Use the plain-English copy'
              : 'No plain-English copy cached — regenerate the brief/needle to create one'
          }
        >
          Plain English
        </button>
      </div>
      {value === 'normie' && !hasPlainEnglish && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          No plain-English version cached — showing regular copy. Regenerate above to create one.
        </div>
      )}
    </div>
  )
}

function ShareDraft({
  title,
  kind,
  meta,
  emptyLabel,
  voice,
  onVoiceChange,
  hasPlainEnglish,
  text,
  onChange,
  onCopyText,
  onSaveImage,
  onCopyImage,
  onPost,
  onThread,
  onUnder280,
  onShowFull,
  onPrevVariant,
  onNextVariant,
  onResetVariant,
  hasFull,
  variantIndex,
  summarizeBusy,
  imageBusy,
  previewUrl,
  panelStyle,
  btnStyle,
  accentBtn,
  hasSource,
}: {
  title: string
  kind: ShareImageKind
  meta: string | null
  emptyLabel: string
  voice: ShareVoice
  onVoiceChange: (v: ShareVoice) => void
  hasPlainEnglish: boolean
  text: string
  onChange: (v: string) => void
  onCopyText: () => void
  onSaveImage: () => void
  onCopyImage: () => void
  onPost: () => void
  onThread: () => void
  onUnder280: () => void
  onShowFull: () => void
  onPrevVariant: () => void
  onNextVariant: () => void
  onResetVariant: () => void
  hasFull: boolean
  variantIndex: number | null
  summarizeBusy: boolean
  imageBusy: string | null
  previewUrl: string | null
  panelStyle: CSSProperties
  btnStyle: CSSProperties
  accentBtn: CSSProperties
  hasSource: boolean
}) {
  const len = useMemo(() => xWeightedLength(text), [text])
  const over = len > X_CHAR_LIMIT
  const busySave = imageBusy === `${kind}-save`
  const busyCopy = imageBusy === `${kind}-copy`

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
      <VoiceToggle
        value={voice}
        onChange={onVoiceChange}
        hasPlainEnglish={hasPlainEnglish}
        btnStyle={btnStyle}
      />
      {variantIndex != null && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Variant {variantIndex + 1} of 3
          </span>
          <button type="button" style={btnStyle} onClick={onPrevVariant}>
            ← Prev
          </button>
          <button type="button" style={btnStyle} onClick={onNextVariant}>
            Next →
          </button>
          <button type="button" style={btnStyle} onClick={onResetVariant}>
            Reset variant
          </button>
        </div>
      )}
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
          {over ? ' — over limit → Under 280 or image' : ''}
        </span>
        <button type="button" style={btnStyle} onClick={onUnder280} disabled={summarizeBusy}>
          {summarizeBusy ? 'Summarizing…' : 'Under 280'}
        </button>
        {hasFull && (
          <button type="button" style={btnStyle} onClick={onShowFull}>
            Show full
          </button>
        )}
        <button type="button" style={btnStyle} onClick={onCopyText}>
          Copy text
        </button>
        <button type="button" style={btnStyle} onClick={onSaveImage} disabled={busySave || busyCopy}>
          {busySave ? 'Saving…' : 'Save as image'}
        </button>
        <button type="button" style={btnStyle} onClick={onCopyImage} disabled={busySave || busyCopy}>
          {busyCopy ? 'Copying…' : 'Copy image'}
        </button>
        <button type="button" style={btnStyle} onClick={onThread}>
          Make thread
        </button>
        <button type="button" style={accentBtn} onClick={onPost}>
          Post on X
        </button>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
        {over
          ? 'Post on X opens a short caption — attach a full PNG after Save/Copy image. Or run Under 280 for a tweet-sized draft (works for text and image).'
          : 'Post on X uses this text. Save as image uses the same draft (short text = less text on the PNG).'}
      </p>
      {previewUrl && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Image preview
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`${title} share preview`}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '420px',
              height: 'auto',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          />
        </div>
      )}
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
