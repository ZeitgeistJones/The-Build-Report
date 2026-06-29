'use client'

import { useState } from 'react'
import { REPOS } from '@/lib/scores'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

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
    setTimeout(() => setSaved(null), 2000)
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
      <div style={{ marginBottom: '24px' }}>
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
  )
}
