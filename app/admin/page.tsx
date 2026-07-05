'use client'

import { useState } from 'react'
import { REPOS } from '@/lib/scores'
import { BULK_REGEN_DEFAULT_BATCH } from '@/lib/bulkRegenConfig'
import { REPO_COLLECTIONS, type RepoCollectionId } from '@/lib/repoCollections'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [excluded, setExcluded] = useState<Record<string, boolean>>({})
  const [autoScored, setAutoScored] = useState<string[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [togglingExclude, setTogglingExclude] = useState<string | null>(null)
  const [flushing, setFlushing] = useState<string | null>(null)
  const [flushed, setFlushed] = useState<string | null>(null)
  const [autoscoreRunning, setAutoscoreRunning] = useState(false)
  const [autoscoreResult, setAutoscoreResult] = useState<string | null>(null)
  const [briefRunning, setBriefRunning] = useState(false)
  const [briefResult, setBriefResult] = useState<string | null>(null)
  const [refreshRunning, setRefreshRunning] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)
  const [chronicleContext, setChronicleContextText] = useState('')
  const [savingChronicle, setSavingChronicle] = useState(false)
  const [chronicleSaved, setChronicleSaved] = useState(false)
  const [ecosystemContext, setEcosystemContextText] = useState('')
  const [savingEcosystem, setSavingEcosystem] = useState(false)
  const [ecosystemSaved, setEcosystemSaved] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<{ trackableCount: number; cachedCount: number; handScoredBaselineCount: number } | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)
  const [bulkFlushAck, setBulkFlushAck] = useState(false)
  const [backupDownloaded, setBackupDownloaded] = useState(false)
  const [collections, setCollections] = useState<Record<RepoCollectionId, string[]>>({
    'cv-related': [],
    'clawd-gated': [],
  })
  const [forceInclude, setForceInclude] = useState<string[]>([])
  const [collectionInputs, setCollectionInputs] = useState<Record<RepoCollectionId, string>>({
    'cv-related': '',
    'clawd-gated': '',
  })
  const [forceIncludeInput, setForceIncludeInput] = useState('')
  const [collectionBusy, setCollectionBusy] = useState<string | null>(null)

  async function refreshGitHubData() {
    setRefreshRunning(true)
    setRefreshResult(null)
    try {
      const res = await fetch('/api/admin/refresh-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        setRefreshResult(
          data.rateLimited
            ? `Refreshed — ${data.trackableRepos} trackable repos. Homepage cache cleared · rate limit hit, commit data may be partial.`
            : `Refreshed — ${data.trackableRepos} trackable repos. Homepage cache cleared.`,
        )
      } else {
        setRefreshResult(data.error ?? 'GitHub refresh failed')
      }
    } catch {
      setRefreshResult('GitHub refresh request failed')
    }
    setRefreshRunning(false)
  }

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

  async function regenerateBuildBrief() {
    setBriefRunning(true)
    setBriefResult(null)
    try {
      const res = await fetch('/api/admin/build-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        setBriefResult(
          `Brief saved — ${data.repoCount} repos, ${data.commitCount} commits. ${String(data.text).slice(0, 140)}…`,
        )
      } else {
        setBriefResult(data.error ?? 'Build brief generation failed')
      }
    } catch {
      setBriefResult('Build brief request failed')
    }
    setBriefRunning(false)
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
      setExcluded(data.excluded ?? {})
      setAutoScored(data.autoScored ?? [])
      setChronicleContextText(data.chronicleContext ?? '')
      setEcosystemContextText(data.ecosystemContext ?? '')
      setCollections(data.collections ?? { 'cv-related': [], 'clawd-gated': [] })
      setForceInclude(data.forceInclude ?? [])
      void loadBulkStatus()
    } else {
      setAuthError('Wrong password.')
    }
  }

  async function toggleExclude(slug: string, currentlyExcluded: boolean) {
    setTogglingExclude(slug)
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: currentlyExcluded ? 'include' : 'exclude',
        password,
        repoId: slug,
      }),
    })
    setExcluded(prev => {
      const next = { ...prev }
      if (currentlyExcluded) delete next[slug]
      else next[slug] = true
      return next
    })
    setTogglingExclude(null)
  }

  async function addCollectionMember(collectionId: RepoCollectionId) {
    const slug = collectionInputs[collectionId].trim()
    if (!slug) return
    setCollectionBusy(`add:${collectionId}:${slug}`)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addCollectionSlug', password, collectionId, slug }),
    })
    const data = await res.json()
    if (data.ok && data.collections) setCollections(data.collections)
    setCollectionInputs(prev => ({ ...prev, [collectionId]: '' }))
    setCollectionBusy(null)
  }

  async function removeCollectionMember(collectionId: RepoCollectionId, slug: string) {
    setCollectionBusy(`rm:${collectionId}:${slug}`)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'removeCollectionSlug', password, collectionId, slug }),
    })
    const data = await res.json()
    if (data.ok && data.collections) setCollections(data.collections)
    setCollectionBusy(null)
  }

  async function addForceIncludeMember() {
    const slug = forceIncludeInput.trim()
    if (!slug) return
    setCollectionBusy(`fi-add:${slug}`)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addForceInclude', password, slug }),
    })
    const data = await res.json()
    if (data.ok && data.forceInclude) setForceInclude(data.forceInclude)
    setForceIncludeInput('')
    setCollectionBusy(null)
  }

  async function removeForceIncludeMember(slug: string) {
    setCollectionBusy(`fi-rm:${slug}`)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'removeForceInclude', password, slug }),
    })
    const data = await res.json()
    if (data.ok && data.forceInclude) setForceInclude(data.forceInclude)
    setCollectionBusy(null)
  }

  async function saveChronicleContext() {
    setSavingChronicle(true)
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveChronicleContext', password, chronicleContext }),
    })
    setSavingChronicle(false)
    setChronicleSaved(true)
    setTimeout(() => setChronicleSaved(false), 2200)
  }

  async function saveEcosystemContext() {
    setSavingEcosystem(true)
    await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveEcosystemContext', password, ecosystemContext }),
    })
    setSavingEcosystem(false)
    setEcosystemSaved(true)
    setTimeout(() => setEcosystemSaved(false), 2200)
  }

  async function loadBulkStatus() {
    try {
      const res = await fetch('/api/admin/bulk-regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', password }),
      })
      const data = await res.json()
      if (data.ok) {
        setBulkStatus({
          trackableCount: data.trackableCount,
          cachedCount: data.cachedCount,
          handScoredBaselineCount: data.handScoredBaselineCount,
        })
      }
    } catch {
      // non-fatal
    }
  }

  async function downloadBaselineBackup() {
    setBulkResult(null)
    try {
      const res = await fetch('/api/admin/bulk-regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exportBaseline', password }),
      })
      const data = await res.json()
      if (!data.ok) {
        setBulkResult(data.error ?? 'Export failed')
        return
      }
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `build-report-baseline-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setBackupDownloaded(true)
      setBulkResult('Baseline backup downloaded.')
    } catch {
      setBulkResult('Baseline export request failed')
    }
  }

  async function runBulkRegenBatch(flushFirst: boolean) {
    setBulkRunning(true)
    setBulkResult(null)
    let offset = 0
    let totalScored = 0
    let totalFailed = 0
    const failedNames: string[] = []

    try {
      while (true) {
        const res = await fetch('/api/admin/bulk-regen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'regenerateBatch',
            password,
            confirmFlush: flushFirst,
            acknowledgeFlush: flushFirst && backupDownloaded,
            offset,
            limit: BULK_REGEN_DEFAULT_BATCH,
          }),
        })

        if (!res.ok) {
          const statusHint =
            res.status === 504
              ? 'Server timed out (504).'
              : `HTTP ${res.status}.`
          setBulkResult(
            `${statusHint} ${totalScored} repo(s) scored so far — deploy the latest admin fix or run locally, then retry (safe to continue).`,
          )
          break
        }

        let data: {
          ok?: boolean
          error?: string
          scored?: string[]
          failed?: string[]
          nextOffset?: number | null
          totalEligible?: number
        }
        try {
          data = await res.json()
        } catch {
          setBulkResult(
            `Invalid response after ${totalScored} repo(s) scored — retry to continue.`,
          )
          break
        }

        if (!data.ok) {
          setBulkResult(data.error ?? 'Bulk regen failed')
          break
        }

        totalScored += (data.scored as string[]).length
        totalFailed += (data.failed as string[]).length
        failedNames.push(...(data.failed as string[]))

        if (data.nextOffset == null) {
          setBulkResult(
            flushFirst
              ? `Bulk regen complete — scored ${totalScored} repo(s)${totalFailed ? `, ${totalFailed} failed (${failedNames.slice(0, 5).join(', ')})` : ''}.`
              : `Batch complete — scored ${totalScored} uncached repo(s) this run.`,
          )
          void loadBulkStatus()
          break
        }
        offset = data.nextOffset as number
        setBulkResult(`In progress… ${totalScored} scored so far (${offset}/${data.totalEligible}).`)
      }
    } catch {
      setBulkResult('Bulk regen request failed')
    }
    setBulkRunning(false)
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
      {/* GitHub data refresh */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>GitHub data</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px' }}>
              Fetches the latest repo list and commit activity from GitHub and clears the homepage cache so new repos appear.
            </p>
          </div>
          <button
            onClick={refreshGitHubData}
            disabled={refreshRunning}
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
            {refreshRunning ? 'Refreshing…' : 'Refresh GitHub data'}
          </button>
        </div>
        {refreshResult && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            {refreshResult}
          </div>
        )}
      </div>

      {/* Chronicle context for rescores */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Chronicle context</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '640px' }}>
            Paste a condensed Chronicle summary here. It is prepended to paid rescore prompts so new scores can reference the same grounding as launch baseline repos.
          </p>
        </div>
        <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <textarea
            value={chronicleContext}
            onChange={e => setChronicleContextText(e.target.value)}
            placeholder="Condensed Chronicle summary for rescore grounding..."
            rows={8}
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              resize: 'vertical',
              marginBottom: '8px',
            }}
          />
          <button
            onClick={saveChronicleContext}
            disabled={savingChronicle}
            style={{
              display: 'block',
              fontSize: '12px',
              padding: '5px 14px',
              borderRadius: 'var(--radius)',
              background: chronicleSaved ? 'var(--accent-dim)' : 'var(--surface-3)',
              color: chronicleSaved ? 'var(--accent)' : 'var(--text-secondary)',
              border: `1px solid ${chronicleSaved ? 'var(--accent-border)' : 'var(--border)'}`,
            }}
          >
            {savingChronicle ? 'Saving…' : chronicleSaved ? 'Saved ✓' : 'Save Chronicle context'}
          </button>
        </div>
      </div>

      {/* Ecosystem context for autoscore */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Ecosystem context</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '640px' }}>
            Background knowledge prepended to all autoscore prompts (batch and paid rescore). Leave empty to use the built-in default.
          </p>
        </div>
        <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <textarea
            value={ecosystemContext}
            onChange={e => setEcosystemContextText(e.target.value)}
            placeholder="Ecosystem facts, repo relationships, tag definitions..."
            rows={8}
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              resize: 'vertical',
              marginBottom: '8px',
            }}
          />
          <button
            onClick={saveEcosystemContext}
            disabled={savingEcosystem}
            style={{
              display: 'block',
              fontSize: '12px',
              padding: '5px 14px',
              borderRadius: 'var(--radius)',
              background: ecosystemSaved ? 'var(--accent-dim)' : 'var(--surface-3)',
              color: ecosystemSaved ? 'var(--accent)' : 'var(--text-secondary)',
              border: `1px solid ${ecosystemSaved ? 'var(--accent-border)' : 'var(--border)'}`,
            }}
          >
            {savingEcosystem ? 'Saving…' : ecosystemSaved ? 'Saved ✓' : 'Save ecosystem context'}
          </button>
        </div>
      </div>

      {/* Filter collections — homepage repo filters */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Filter collections</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '640px', lineHeight: 1.6 }}>
            Curated slug lists for homepage filters (CV &amp; gov, CLAWD-gated). Add or remove GitHub slugs — no deploy needed.
            Defaults are baked in; removals hide defaults, additions extend the list.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {REPO_COLLECTIONS.map(def => (
            <div
              key={def.id}
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{def.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.45 }}>
                {def.tooltip}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {(collections[def.id] ?? []).map(slug => (
                  <span
                    key={slug}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      padding: '3px 8px',
                      borderRadius: '99px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {slug}
                    <button
                      type="button"
                      onClick={() => void removeCollectionMember(def.id, slug)}
                      disabled={collectionBusy === `rm:${def.id}:${slug}`}
                      style={{ fontSize: '10px', color: 'var(--text-muted)', padding: 0 }}
                      aria-label={`Remove ${slug}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {!collections[def.id]?.length && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No slugs</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={collectionInputs[def.id]}
                  onChange={e => setCollectionInputs(prev => ({ ...prev, [def.id]: e.target.value }))}
                  placeholder="github-slug"
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void addCollectionMember(def.id)
                  }}
                />
                <button
                  type="button"
                  onClick={() => void addCollectionMember(def.id)}
                  disabled={!collectionInputs[def.id].trim() || collectionBusy?.startsWith(`add:${def.id}`)}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: '16px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
            maxWidth: '520px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Force-track repos</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.45 }}>
            Bypass job-* / cv-* skip rules so repos like <code style={{ fontSize: '10px' }}>leftclaw-service-job-66</code> appear in the list. Run GitHub refresh after adding.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {forceInclude.map(slug => (
              <span
                key={slug}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  padding: '3px 8px',
                  borderRadius: '99px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                {slug}
                <button
                  type="button"
                  onClick={() => void removeForceIncludeMember(slug)}
                  disabled={collectionBusy === `fi-rm:${slug}`}
                  style={{ fontSize: '10px', color: 'var(--text-muted)', padding: 0 }}
                >
                  ✕
                </button>
              </span>
            ))}
            {!forceInclude.length && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None — job-* repos stay hidden</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={forceIncludeInput}
              onChange={e => setForceIncludeInput(e.target.value)}
              placeholder="leftclaw-service-job-66"
              style={{
                flex: 1,
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                padding: '6px 10px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') void addForceIncludeMember()
              }}
            />
            <button
              type="button"
              onClick={() => void addForceIncludeMember()}
              disabled={!forceIncludeInput.trim()}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
              }}
            >
              Track
            </button>
          </div>
        </div>
      </div>

      {/* Context notes */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Admin — context notes</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Add context notes to any repo card. Notes appear publicly below the verdict. Scores cannot be changed here.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {REPOS.map(repo => {
            const isExcluded = excluded[repo.githubSlug] === true
            return (
            <div key={repo.id} style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              opacity: isExcluded ? 0.55 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)', color: isExcluded ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                  {repo.name}
                  {isExcluded && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>excluded</span>}
                </div>
                <button
                  onClick={() => toggleExclude(repo.githubSlug, isExcluded)}
                  disabled={togglingExclude === repo.githubSlug}
                  style={{
                    fontSize: '12px',
                    padding: '5px 14px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface-3)',
                    color: isExcluded ? 'var(--accent)' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                >
                  {togglingExclude === repo.githubSlug ? '…' : isExcluded ? 'Include' : 'Exclude'}
                </button>
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
            )
          })}
        </div>
      </div>

      {/* Scoring v2 — bulk regenerate */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Bulk regenerate (Live AI)</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '620px', lineHeight: 1.6 }}>
            Download a baseline backup before flushing. Scores {BULK_REGEN_DEFAULT_BATCH} repos per request to avoid server timeouts — the button runs until all are done.
            Bulk flush replaces cached Live AI scores with the current v3 prompt and rubrics.
          </p>
          {bulkStatus && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {bulkStatus.trackableCount} trackable repos · {bulkStatus.cachedCount} cached Live AI · {bulkStatus.handScoredBaselineCount} hand-scored baselines in code
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <button
            onClick={() => void downloadBaselineBackup()}
            style={{
              fontSize: '12px',
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-3)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
            }}
          >
            Download baseline backup
          </button>
          <button
            onClick={() => void runBulkRegenBatch(false)}
            disabled={bulkRunning}
            style={{
              fontSize: '12px',
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-3)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            {bulkRunning ? 'Running…' : 'Score uncached only (no flush)'}
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', maxWidth: '520px' }}>
          <input
            type="checkbox"
            checked={bulkFlushAck}
            onChange={e => setBulkFlushAck(e.target.checked)}
            style={{ marginTop: '3px' }}
          />
          <span>I downloaded the baseline backup and approve flushing all cached scores before bulk regen.</span>
        </label>
        <button
          onClick={() => void runBulkRegenBatch(true)}
          disabled={bulkRunning || !bulkFlushAck || !backupDownloaded}
          style={{
            fontSize: '12px',
            padding: '8px 16px',
            borderRadius: 'var(--radius)',
            background: bulkFlushAck && backupDownloaded ? 'var(--accent-dim)' : 'var(--surface-3)',
            color: bulkFlushAck && backupDownloaded ? 'var(--accent)' : 'var(--text-muted)',
            border: `1px solid ${bulkFlushAck && backupDownloaded ? 'var(--accent-border)' : 'var(--border)'}`,
          }}
        >
          {bulkRunning ? 'Bulk regenerating…' : 'Flush all & bulk regenerate'}
        </button>
        {bulkResult && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            {bulkResult}
          </div>
        )}
      </div>

      {/* Build brief */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Build brief</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px' }}>
              Daily AI summary of what got worked on in the last 24h (sampled repos). Regenerates automatically after the daily autoscore cron; use this to refresh immediately after a GitHub scan.
            </p>
          </div>
          <button
            onClick={regenerateBuildBrief}
            disabled={briefRunning}
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
            {briefRunning ? 'Generating…' : 'Regenerate build brief'}
          </button>
        </div>
        {briefResult && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            {briefResult}
          </div>
        )}
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
            {autoScored.map(name => {
              const isExcluded = excluded[name] === true
              return (
              <div key={name} style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: isExcluded ? 0.55 : 1,
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)', color: isExcluded ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {name}
                    {isExcluded && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>excluded</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    auto-inferred · cached in Redis
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => toggleExclude(name, isExcluded)}
                    disabled={togglingExclude === name}
                    style={{
                      fontSize: '12px',
                      padding: '5px 14px',
                      borderRadius: 'var(--radius)',
                      background: 'var(--surface-3)',
                      color: isExcluded ? 'var(--accent)' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {togglingExclude === name ? '…' : isExcluded ? 'Include' : 'Exclude'}
                  </button>
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
              </div>
              )
            })}
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
