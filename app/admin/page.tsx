'use client'

import { useState } from 'react'
import { REPOS } from '@/lib/scores'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [autoScored, setAutoScored] = useState<string[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [flushing, setFlushing] = useState<string | null>(null)
  const [flushed, setFlushed] = useState<string | null>(null)
  const [autoscoreRunning, setAutoscoreRunning] = useState(false)
  const [autoscoreResult, setAutoscoreResult] = useState<string | null>(null)

  async function runAutoscore() {
    setAutoscoreRunning(true)
    setAutoscoreResult(null)
    try {
      const res = await fetch('/api/autoscore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        const inferred = (data.inferred as string[] | undefined) ?? []
        setAutoscoreResult(
          inferred.length
            ? `Scored ${inferred.length} repo(s): ${inferred.join(', ')}${data.deferred ? ` · ${data.deferred} still queued` : ''}`
            : data.deferred
              ? `No new scores this run · ${data.deferred} still queued`
              : 'All trackable repos are scored.',
        )
        if (inferred.length) {
          setAutoScored(prev => Array.from(new Set([...inferred, ...prev])).sort())
        }
      } else {
        setAutoscoreResult(data.error ?? 'Autoscore failed')
      }
    } catch {
      setAutoscoreResult('Autoscore request failed')
    }
    setAutoscoreRunning(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'auth', password }),
    })
    const data = await res.json()
    if (data.ok) {
      setAuthed(true)
      setNotes(data.notes ?? {})
      setAutoScored(data.autoScored ?? [])
    } else {
      setAuthError('Wrong password.')
    }
  }

  async function saveNote(repoId: string) {
    setSaving(repoId)
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', password, repoId, note: notes[repoId] ?? '' }),
    })
    setSaving(null)
    setSaved(repoId)
    setTimeout(() => setSaved(null), 2200)
  }

  async function flushScore(repoName: string) {
    setFlushing(repoName)
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'flush', password, repoId: repoName }),
    })
    setFlushing(null)
    setFlushed(repoName)
    setAutoScored(prev => prev.filter(r => r !== repoName))
    setTimeout(() => setFlushed(null), 2200)
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: '360px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Admin</h1>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'var(--font-sans)',
            }}
          />
          {authError && <p style={{ fontSize: '13px', color: 'var(--red)' }}>{authError}</p>}
          <button
            type="submit"
            style={{
              background: 'var(--surface-3)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius)',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Sign in
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      {/* Context notes */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Admin — context notes</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Add context notes to any repo card. Notes appear publicly below the verdict. Scores cannot be changed here.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {REPOS.map(repo => (
            <div key={repo.id} style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: '8px' }}>
                {repo.name}
              </div>
              <textarea
                value={notes[repo.id] ?? ''}
                onChange={e => setNotes(prev => ({ ...prev, [repo.id]: e.target.value }))}
                placeholder="Add a context note (leave blank to remove)..."
                rows={2}
                style={{
                  width: '100%',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-sans)',
                  resize: 'vertical',
                  marginBottom: '8px',
                }}
              />
              <button
                onClick={() => saveNote(repo.id)}
                disabled={saving === repo.id}
                style={{
                  fontSize: '12px',
                  padding: '5px 14px',
                  borderRadius: 'var(--radius)',
                  background: saved === repo.id ? 'var(--accent-dim)' : 'var(--surface-3)',
                  color: saved === repo.id ? 'var(--accent)' : 'var(--text-secondary)',
                  border: `1px solid ${saved === repo.id ? 'var(--accent-border)' : 'var(--border)'}`,
                }}
              >
                {saving === repo.id ? 'Saving...' : saved === repo.id ? 'Saved ✓' : 'Save note'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Auto-scored repos */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Auto-inferred scores</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px' }}>
              Unscored GitHub repos are inferred by Claude and cached in Redis. On Vercel Hobby, autoscore runs once daily via cron (up to 15 repos per run). Use the button below to score immediately. Priority follows GitHub repo order (visible list first).
            </p>
          </div>
          <button
            onClick={runAutoscore}
            disabled={autoscoreRunning}
            style={{
              fontSize: '12px',
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-3)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              flexShrink: 0,
            }}
          >
            {autoscoreRunning ? 'Running autoscore…' : 'Run autoscore now'}
          </button>
        </div>
        {autoscoreResult && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            {autoscoreResult}
          </div>
        )}
      </div>

      {autoScored.length > 0 && (
        <div>
          <div style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
            Cached auto-inferred ({autoScored.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {autoScored.map(name => (
              <div key={name} style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    auto-inferred · cached in Redis
                  </div>
                </div>
                <button
                  onClick={() => flushScore(name)}
                  disabled={flushing === name}
                  style={{
                    fontSize: '12px',
                    padding: '5px 14px',
                    borderRadius: 'var(--radius)',
                    background: flushed === name ? 'var(--accent-dim)' : 'var(--surface-3)',
                    color: flushed === name ? 'var(--accent)' : 'var(--red)',
                    border: `1px solid ${flushed === name ? 'var(--accent-border)' : 'var(--border)'}`,
                  }}
                >
                  {flushing === name ? 'Flushing...' : flushed === name ? 'Flushed ✓' : 'Flush & re-infer'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {autoScored.length === 0 && (
        <div style={{
          padding: '16px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: '13px',
          color: 'var(--text-muted)',
        }}>
          No auto-inferred scores cached yet. Use Run autoscore now to score unscored repos from GitHub.
        </div>
      )}
    </div>
  )
}
