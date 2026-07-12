'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { STARTER_KIT_POSTS } from '@/lib/starterKitPosts'
import { X_CHAR_LIMIT, xIntentUrl, xWeightedLength } from '@/lib/xSharePosts'

export default function AdminStarterKitShare() {
  const [variantIndex, setVariantIndex] = useState<Record<string, number>>(() =>
    Object.fromEntries(STARTER_KIT_POSTS.map(p => [p.id, 0])),
  )
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(STARTER_KIT_POSTS.map(p => [p.id, p.variants[0]])),
  )
  const [copied, setCopied] = useState<string | null>(null)

  function currentVariant(id: string): number {
    return variantIndex[id] ?? 0
  }

  function setVariant(id: string, next: number) {
    const post = STARTER_KIT_POSTS.find(p => p.id === id)
    if (!post) return
    const idx = ((next % 3) + 3) % 3
    setVariantIndex(prev => ({ ...prev, [id]: idx }))
    setDrafts(prev => ({ ...prev, [id]: post.variants[idx]! }))
  }

  function reset(id: string) {
    const post = STARTER_KIT_POSTS.find(p => p.id === id)
    if (!post) return
    const idx = currentVariant(id)
    setDrafts(prev => ({ ...prev, [id]: post.variants[idx]! }))
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  function openOnX(text: string) {
    window.open(xIntentUrl(text), '_blank', 'noopener,noreferrer')
  }

  const panelStyle: CSSProperties = {
    marginBottom: '12px',
    padding: '12px 14px',
    background: 'var(--surface-1)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  }

  const btnStyle: CSSProperties = {
    fontSize: '12px',
    padding: '7px 12px',
    borderRadius: 'var(--radius)',
    background: 'var(--surface-3)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-strong)',
    cursor: 'pointer',
  }

  const accentBtn: CSSProperties = {
    ...btnStyle,
    background: 'var(--accent)',
    color: 'var(--accent-contrast, #fff)',
    border: '1px solid var(--accent)',
  }

  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Starter kit</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '560px' }}>
          Evergreen site explainers for X — not Yesterday&apos;s Build or The Needle. Seven topics,
          three wording options each. Cycle if one doesn&apos;t land, edit before posting.
        </p>
      </div>

      {copied && (
        <div style={{ ...panelStyle, color: 'var(--accent)', fontSize: '12px' }}>
          Copied {copied}
        </div>
      )}

      {STARTER_KIT_POSTS.map((post, i) => {
        const idx = currentVariant(post.id)
        const text = drafts[post.id] ?? post.variants[idx]!
        return (
          <StarterCard
            key={post.id}
            index={i + 1}
            title={post.title}
            variantIndex={idx}
            text={text}
            onChange={v => setDrafts(prev => ({ ...prev, [post.id]: v }))}
            onPrev={() => setVariant(post.id, idx - 1)}
            onNext={() => setVariant(post.id, idx + 1)}
            onReset={() => reset(post.id)}
            onCopy={() => copyText(post.title, text)}
            onPost={() => openOnX(text)}
            panelStyle={panelStyle}
            btnStyle={btnStyle}
            accentBtn={accentBtn}
          />
        )
      })}
    </div>
  )
}

function StarterCard({
  index,
  title,
  variantIndex,
  text,
  onChange,
  onPrev,
  onNext,
  onReset,
  onCopy,
  onPost,
  panelStyle,
  btnStyle,
  accentBtn,
}: {
  index: number
  title: string
  variantIndex: number
  text: string
  onChange: (v: string) => void
  onPrev: () => void
  onNext: () => void
  onReset: () => void
  onCopy: () => void
  onPost: () => void
  panelStyle: CSSProperties
  btnStyle: CSSProperties
  accentBtn: CSSProperties
}) {
  const len = useMemo(() => xWeightedLength(text), [text])
  const over = len > X_CHAR_LIMIT

  return (
    <div style={{ ...panelStyle, marginBottom: '16px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <strong style={{ fontSize: '13px' }}>
          {index}. {title}
        </strong>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Variant {variantIndex + 1} of 3
        </span>
        <button type="button" style={btnStyle} onClick={onPrev} aria-label="Previous variant">
          ← Prev
        </button>
        <button type="button" style={btnStyle} onClick={onNext} aria-label="Next variant">
          Next →
        </button>
      </div>
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        rows={7}
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
          {over ? ' — over limit' : ''}
        </span>
        <button type="button" style={btnStyle} onClick={onReset}>
          Reset
        </button>
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
