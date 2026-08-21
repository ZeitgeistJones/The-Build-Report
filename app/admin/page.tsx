'use client'

import { useEffect, useState } from 'react'
import { REPOS } from '@/lib/scores'
import { BULK_REGEN_DEFAULT_BATCH } from '@/lib/bulkRegenConfig'
import { REPO_COLLECTIONS, type RepoCollectionId } from '@/lib/repoCollections'
import type { CommunityContextSubmission } from '@/lib/communityContextTypes'
import type { OverheardEntry } from '@/lib/podcastMentions'
import type { UtilityIndexRow } from '@/lib/utilityIndex'
import {
  EXTERNAL_BRIEF_ACCOUNTS,
  type ExternalBriefAccountId,
  type ExternalBriefData,
} from '@/lib/externalOwnerBrief'
import OverheardAdminEntryCard, { mentionToEditDraft, sanitizeDraftForSave, type MentionEditDraft } from '@/components/OverheardAdminEntryCard'
import AdminStarterKitShare from '@/components/AdminStarterKitShare'
import UtilityLedger from '@/components/UtilityLedger'
import ExternalBriefsNewspaper from '@/components/ExternalBriefsNewspaper'
import YbLeadStoryLab from '@/components/YbLeadStoryLab'
import McpWire from '@/components/McpWire'
import McpWireInbox from '@/components/McpWireInbox'
import AdminSectionNav, { AdminBackToNav } from '@/components/AdminSectionNav'
import type { McpWireAdminRecord } from '@/lib/mcpWire'

type AdminContextSubmission = CommunityContextSubmission

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
  const [needleRunning, setNeedleRunning] = useState(false)
  const [needleResult, setNeedleResult] = useState<string | null>(null)
  const [adminRescoreSlug, setAdminRescoreSlug] = useState('')
  const [adminRescoreRunning, setAdminRescoreRunning] = useState(false)
  const [adminRescoreResult, setAdminRescoreResult] = useState<string | null>(null)
  const [behindCount, setBehindCount] = useState<number | null>(null)
  const [behindPreview, setBehindPreview] = useState<string[]>([])
  const [behindRunning, setBehindRunning] = useState(false)
  const [behindResult, setBehindResult] = useState<string | null>(null)
  const [wireRunning, setWireRunning] = useState(false)
  const [wireResult, setWireResult] = useState<string | null>(null)
  const [wireAdmin, setWireAdmin] = useState<McpWireAdminRecord | null>(null)
  const [podcastScanRunning, setPodcastScanRunning] = useState(false)
  const [podcastScanResult, setPodcastScanResult] = useState<string | null>(null)
  const [overheardMode, setOverheardModeState] = useState<'automatic' | 'manual'>('automatic')
  const [modeSaving, setModeSaving] = useState(false)
  const [candidateMentions, setCandidateMentions] = useState<OverheardEntry[]>([])
  const [pendingMentions, setPendingMentions] = useState<OverheardEntry[]>([])
  const [publishedMentions, setPublishedMentions] = useState<OverheardEntry[]>([])
  const [mentionsListLoading, setMentionsListLoading] = useState(false)
  const [mentionActionBusy, setMentionActionBusy] = useState<string | null>(null)
  const [candidateContextDrafts, setCandidateContextDrafts] = useState<Record<string, string>>({})
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [mentionEditDrafts, setMentionEditDrafts] = useState<Record<string, MentionEditDraft>>({})
  const [editingMentionIds, setEditingMentionIds] = useState<string[]>([])
  const [groupThreadError, setGroupThreadError] = useState<string | null>(null)
  const [spottedTweetUrl, setSpottedTweetUrl] = useState('')
  const [spottedTweetText, setSpottedTweetText] = useState('')
  const [spottedAccountContext, setSpottedAccountContext] = useState('')
  const [spottedExtraContext, setSpottedExtraContext] = useState('')
  const [spottedRepoSlug, setSpottedRepoSlug] = useState('')
  const [spottedGenerating, setSpottedGenerating] = useState(false)
  const [spottedDraft, setSpottedDraft] = useState<{ id: string; writeup: string; embedHtml: string; authorName: string } | null>(null)
  const [spottedDraftsList, setSpottedDraftsList] = useState<Array<{
    id: string; writeup: string; embedHtml: string; authorName: string; tweetUrl: string
  }>>([])
  const [spottedPublishedList, setSpottedPublishedList] = useState<Array<{
    id: string
    writeup: string
    authorName: string
    tweetUrl: string
    publishedAt: string | null
    status?: string
  }>>([])
  const [spottedActionBusy, setSpottedActionBusy] = useState<string | null>(null)
  const [refreshRunning, setRefreshRunning] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)
  const [ecosystemContext, setEcosystemContextText] = useState('')
  const [savingEcosystem, setSavingEcosystem] = useState(false)
  const [ecosystemSaved, setEcosystemSaved] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<{ trackableCount: number; cachedCount: number; handScoredBaselineCount: number } | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)
  const [bulkFlushAck, setBulkFlushAck] = useState(false)
  const [backupDownloaded, setBackupDownloaded] = useState(false)
  const [normieBackfillRunning, setNormieBackfillRunning] = useState(false)
  const [collections, setCollections] = useState<Record<RepoCollectionId, string[]>>({
    'cv-related': [],
    'clawd-gated': [],
  })
  const [forceInclude, setForceInclude] = useState<string[]>([])
  const [utilityRows, setUtilityRows] = useState<UtilityIndexRow[]>([])
  const [utilityEnriched, setUtilityEnriched] = useState(0)
  const [utilityTotal, setUtilityTotal] = useState(0)
  const [utilityUpdatedAt, setUtilityUpdatedAt] = useState<string | null>(null)
  const [utilityLoading, setUtilityLoading] = useState(false)
  const [utilityError, setUtilityError] = useState<string | null>(null)
  const [externalBriefs, setExternalBriefs] = useState<
    Partial<Record<ExternalBriefAccountId, ExternalBriefData | null>>
  >({})
  const [externalLoading, setExternalLoading] = useState<Partial<Record<ExternalBriefAccountId, boolean>>>({})
  const [externalRunning, setExternalRunning] = useState<Partial<Record<ExternalBriefAccountId, boolean>>>({})
  const [externalResults, setExternalResults] = useState<Partial<Record<ExternalBriefAccountId, string | null>>>({})
  const [collectionInputs, setCollectionInputs] = useState<Record<RepoCollectionId, string>>({
    'cv-related': '',
    'clawd-gated': '',
  })
  const [forceIncludeInput, setForceIncludeInput] = useState('')
  const [collectionBusy, setCollectionBusy] = useState<string | null>(null)
  const [contextModId, setContextModId] = useState('')
  const [contextModBusy, setContextModBusy] = useState<string | null>(null)
  const [contextModResult, setContextModResult] = useState<string | null>(null)
  const [contextList, setContextList] = useState<AdminContextSubmission[]>([])
  const [contextListBusy, setContextListBusy] = useState(false)

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
        void loadBehindStatus()
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

  async function loadMentionsReview() {
    setMentionsListLoading(true)
    try {
      const res = await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'list' }),
      })
      const data = await res.json()
      if (data.ok) {
        setCandidateMentions(data.candidates ?? [])
        setPendingMentions(data.pending ?? [])
        setPublishedMentions(data.published ?? [])
        setOverheardModeState(data.mode ?? 'automatic')
        setSelectedCandidateIds([])
        const drafts: Record<string, MentionEditDraft> = {}
        for (const entry of [...(data.pending ?? []), ...(data.published ?? [])] as OverheardEntry[]) {
          drafts[entry.id] = mentionToEditDraft(entry)
        }
        setMentionEditDrafts(drafts)
        setEditingMentionIds(prev => prev.filter(id => drafts[id]))
      }
    } catch {
      // ignore
    }
    setMentionsListLoading(false)
  }

  async function setOverheardMode(mode: 'automatic' | 'manual') {
    setModeSaving(true)
    try {
      const res = await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'setMode', mode }),
      })
      const data = await res.json()
      if (data.ok) setOverheardModeState(data.mode)
    } catch {
      // ignore
    }
    setModeSaving(false)
  }

  async function addContextToCandidate(id: string) {
    setMentionActionBusy(id)
    try {
      await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'addContext', id, context: candidateContextDrafts[id] ?? '' }),
      })
    } catch {
      // ignore
    }
    setMentionActionBusy(null)
  }

  async function confirmCandidate(id: string) {
    setMentionActionBusy(id)
    try {
      await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'confirm', id }),
      })
      setCandidateMentions(prev => prev.filter(m => m.id !== id))
      void loadMentionsReview()
    } catch {
      // ignore
    }
    setMentionActionBusy(null)
  }

  async function groupSelectedCandidates() {
    if (selectedCandidateIds.length < 2) return
    setGroupThreadError(null)
    setMentionActionBusy('group-thread')
    try {
      const res = await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'groupThread', ids: selectedCandidateIds }),
      })
      const data = await res.json()
      if (data.ok) {
        setSelectedCandidateIds([])
        void loadMentionsReview()
      } else {
        setGroupThreadError(typeof data.error === 'string' ? data.error : 'Threads must be same repo and same episode')
      }
    } catch {
      setGroupThreadError('Threads must be same repo and same episode')
    }
    setMentionActionBusy(null)
  }

  function toggleCandidateSelection(id: string) {
    setGroupThreadError(null)
    setSelectedCandidateIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  function toggleMentionEdit(id: string, entry: OverheardEntry) {
    setEditingMentionIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      setMentionEditDrafts(drafts => ({ ...drafts, [id]: mentionToEditDraft(entry) }))
      return [...prev, id]
    })
  }

  async function saveMentionEdit(id: string) {
    const draft = mentionEditDrafts[id]
    if (!draft) return
    const sanitized = sanitizeDraftForSave(draft)
    setMentionActionBusy(`save:${id}`)
    try {
      const res = await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          action: 'updateEntry',
          id,
          writeup: sanitized.writeup,
          repoSlug: sanitized.repoSlug,
          userContext: sanitized.userContext,
          quotes: sanitized.quotes,
        }),
      })
      const data = await res.json()
      if (data.ok) void loadMentionsReview()
    } catch {
      // ignore
    }
    setMentionActionBusy(null)
  }

  async function takeDownPublished(id: string) {
    setMentionActionBusy(id)
    try {
      const res = await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'takeDown', id }),
      })
      const data = await res.json()
      if (data.ok) {
        setPublishedMentions(prev =>
          prev.map(m => (m.id === id ? { ...m, status: 'archived' as const } : m)),
        )
      }
    } catch {
      // ignore
    }
    setMentionActionBusy(null)
  }

  async function removePublishedFromArchives(id: string) {
    setMentionActionBusy(id)
    try {
      const res = await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'removeFromArchives', id }),
      })
      const data = await res.json()
      if (data.ok) {
        setPublishedMentions(prev => prev.filter(m => m.id !== id))
        setEditingMentionIds(prev => prev.filter(x => x !== id))
      }
    } catch {
      // ignore
    }
    setMentionActionBusy(null)
  }

  async function movePublishedToPending(id: string) {
    setMentionActionBusy(id)
    try {
      const res = await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'moveToPending', id }),
      })
      const data = await res.json()
      if (data.ok) void loadMentionsReview()
    } catch {
      // ignore
    }
    setMentionActionBusy(null)
  }

  async function regeneratePendingWriteup(id: string) {
    setMentionActionBusy(`regen:${id}`)
    try {
      const res = await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'regenerateWriteup', id }),
      })
      const data = await res.json()
      if (data.ok && typeof data.writeup === 'string') {
        setMentionEditDrafts(prev => {
          const current = prev[id]
          if (!current) return prev
          return { ...prev, [id]: { ...current, writeup: data.writeup } }
        })
      }
    } catch {
      // ignore
    }
    setMentionActionBusy(null)
  }

  async function actOnPendingMention(id: string, action: 'publish' | 'dismiss') {
    setMentionActionBusy(id)
    try {
      const draft = mentionEditDrafts[id]
      if (action === 'publish' && draft) {
        const sanitized = sanitizeDraftForSave(draft)
        await fetch('/api/admin/podcast-mentions-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password,
            action: 'updateEntry',
            id,
            writeup: sanitized.writeup,
            repoSlug: sanitized.repoSlug,
            userContext: sanitized.userContext,
            quotes: sanitized.quotes,
          }),
        })
      }
      const writeup = action === 'publish' && draft ? sanitizeDraftForSave(draft).writeup : undefined
      await fetch('/api/admin/podcast-mentions-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          action,
          id,
          ...(writeup !== undefined ? { writeup } : {}),
        }),
      })
      void loadMentionsReview()
    } catch {
      // ignore
    }
    setMentionActionBusy(null)
  }

  async function generateSpottedDraft() {
    setSpottedGenerating(true)
    try {
      const res = await fetch('/api/admin/spotted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          action: 'generate',
          tweetUrl: spottedTweetUrl,
          tweetText: spottedTweetText,
          accountContext: spottedAccountContext,
          extraContext: spottedExtraContext,
          repoSlug: spottedRepoSlug || null,
        }),
      })
      const data = await res.json()
      if (data.ok) setSpottedDraft(data.entry)
    } catch {
      // ignore
    }
    setSpottedGenerating(false)
  }

  async function loadSpottedDrafts() {
    try {
      const res = await fetch('/api/admin/spotted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'list' }),
      })
      const data = await res.json()
      if (data.ok) {
        setSpottedDraftsList(data.drafts ?? [])
        setSpottedPublishedList(data.published ?? [])
      }
    } catch {
      // ignore
    }
  }

  async function takeDownSpotted(id: string) {
    setSpottedActionBusy(id)
    try {
      const res = await fetch('/api/admin/spotted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'takeDown', id }),
      })
      const data = await res.json()
      if (data.ok) {
        setSpottedPublishedList(prev =>
          prev.map(d => (d.id === id ? { ...d, status: 'archived' } : d)),
        )
      }
    } catch {
      // ignore
    }
    setSpottedActionBusy(null)
  }

  async function removeSpottedFromArchives(id: string) {
    setSpottedActionBusy(id)
    try {
      const res = await fetch('/api/admin/spotted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'removeFromArchives', id }),
      })
      const data = await res.json()
      if (data.ok) {
        setSpottedPublishedList(prev => prev.filter(d => d.id !== id))
      }
    } catch {
      // ignore
    }
    setSpottedActionBusy(null)
  }

  async function actOnSpottedDraft(id: string, action: 'publish' | 'dismiss') {
    setSpottedActionBusy(id)
    try {
      const writeup =
        action === 'publish'
          ? spottedDraft?.id === id
            ? spottedDraft.writeup
            : spottedDraftsList.find(d => d.id === id)?.writeup
          : undefined
      const res = await fetch('/api/admin/spotted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action, id, ...(writeup !== undefined ? { writeup } : {}) }),
      })
      const data = await res.json()
      setSpottedDraftsList(prev => prev.filter(d => d.id !== id))
      if (spottedDraft?.id === id) setSpottedDraft(null)
      if (action === 'publish' && data.ok) {
        void loadSpottedDrafts()
      }
    } catch {
      // ignore
    }
    setSpottedActionBusy(null)
  }

  async function runPodcastScan(action: 'scanOne' | 'scanAll' | 'rescanAll' | 'clearHistory') {
    setPodcastScanRunning(true)
    setPodcastScanResult(null)
    try {
      const res = await fetch('/api/admin/podcast-mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action }),
      })
      const data = await res.json()
      if (data.ok) {
        if (action === 'clearHistory') {
          setPodcastScanResult(
            `Cleared scan history for ${data.cleared ?? 0} episode${data.cleared === 1 ? '' : 's'}. Use Scan next / Scan all new to reprocess.`,
          )
        } else if (action === 'scanOne') {
          if (!data.scanned) {
            setPodcastScanResult(
              `No unscanned episodes left (${data.totalEpisodes ?? 0} on-chain). Clear scan history to start over.`,
            )
          } else {
            setPodcastScanResult(
              `Scanned: ${data.episodeName ?? data.episodeSlug} — ${data.mentionsFound} mention${data.mentionsFound === 1 ? '' : 's'} (${data.remaining} of ${data.totalEpisodes} remaining, ${data.mode} mode).`,
            )
          }
        } else {
          const skipped = data.skippedAlreadyScanned ?? 0
          setPodcastScanResult(
            `Scanned ${data.scanned}/${data.totalEpisodes ?? '?'} episode${data.scanned === 1 ? '' : 's'}` +
              (skipped ? ` (${skipped} already scanned, skipped)` : '') +
              ` — ${data.mentionsFound} mention${data.mentionsFound === 1 ? '' : 's'} found (${data.mode ?? overheardMode} mode).`,
          )
        }
        if ((data.mentionsFound ?? 0) > 0) void loadMentionsReview()
      } else {
        setPodcastScanResult(data.error ?? 'Podcast scan failed')
      }
    } catch {
      setPodcastScanResult('Podcast scan request failed')
    }
    setPodcastScanRunning(false)
  }

  async function loadMcpWire(pw: string) {
    try {
      const res = await fetch('/api/admin/mcp-wire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json()
      if (data.ok) setWireAdmin(data.admin ?? null)
    } catch {
      /* inbox stays empty until refresh */
    }
  }

  async function refreshMcpWire() {
    setWireRunning(true)
    setWireResult(null)
    try {
      const res = await fetch('/api/admin/mcp-wire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action: 'refresh' }),
      })
      const data = await res.json()
      if (data.ok && data.admin) {
        setWireAdmin(data.admin)
        setWireResult(data.summary ?? 'Wire refreshed')
      } else if (data.ok && data.wire) {
        const w = data.wire
        if (w.status === 'failed') {
          setWireResult(`Failed — registry unavailable. Watermark NOT advanced.`)
        } else if (w.status === 'partial') {
          setWireResult('Partial — page safety limit reached. Watermark NOT advanced.')
        } else {
          setWireResult(data.summary ?? 'Wire refreshed')
        }
      } else {
        setWireResult(data.error ?? 'Wire refresh failed')
      }
    } catch {
      setWireResult('Wire request failed')
    }
    setWireRunning(false)
  }

  async function regenerateNeedle() {
    setNeedleRunning(true)
    setNeedleResult(null)
    try {
      const res = await fetch('/api/admin/needle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        setNeedleResult(
          data.generated
            ? `Needle saved — ${data.repoCount} repos. ${String(data.text).slice(0, 140)}…`
            : 'No qualifying rescores in the last 24h — Needle not generated.',
        )
      } else {
        setNeedleResult(data.error ?? 'Needle generation failed')
      }
    } catch {
      setNeedleResult('Needle request failed')
    }
    setNeedleRunning(false)
  }

  async function runAdminRescore() {
    const repoSlug = adminRescoreSlug.trim()
    if (!repoSlug) {
      setAdminRescoreResult('Enter a GitHub slug (owner/repo)')
      return
    }
    setAdminRescoreRunning(true)
    setAdminRescoreResult(null)
    try {
      const res = await fetch('/api/admin/rescore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, repoSlug }),
      })
      const data = await res.json()
      if (data.ok) {
        setAdminRescoreResult(
          `Rescored ${repoSlug} — ${data.rescoreMeta?.deltaHeader ?? 'saved'}. ${String(data.changeSummary ?? '').slice(0, 160)}`,
        )
      } else {
        setAdminRescoreResult(data.error ?? 'Admin rescore failed')
      }
    } catch {
      setAdminRescoreResult('Admin rescore request failed')
    }
    setAdminRescoreRunning(false)
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
        if (data.source === 'fallback') {
          setBriefResult(
            `Gemini did not write Yesterday's Build (${data.geminiError || 'empty/unparseable response'}). Template copy was saved so the homepage is not blank.`,
          )
        } else {
          setBriefResult(
            `Brief saved — ${data.repoCount} repos, ${data.commitCount} commits. ${String(data.text).slice(0, 140)}…`,
          )
        }
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
      setEcosystemContextText(data.ecosystemContext ?? '')
      setCollections(data.collections ?? { 'cv-related': [], 'clawd-gated': [] })
      setForceInclude(data.forceInclude ?? [])
      void loadBulkStatus()
      void loadBehindStatus()
      void loadUtilityIndex(password)
      void loadMcpWire(password)
      for (const account of EXTERNAL_BRIEF_ACCOUNTS) {
        void loadExternalBrief(account.id, password)
      }
    } else {
      setAuthError('Wrong password.')
    }
  }

  async function loadUtilityIndex(pw: string) {
    setUtilityLoading(true)
    setUtilityError(null)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'utilityIndex', password: pw }),
      })
      const data = await res.json()
      if (data.ok) {
        setUtilityRows(Array.isArray(data.rows) ? data.rows : [])
        setUtilityEnriched(typeof data.enrichedCount === 'number' ? data.enrichedCount : 0)
        setUtilityTotal(typeof data.totalCount === 'number' ? data.totalCount : 0)
        setUtilityUpdatedAt(typeof data.updatedAt === 'string' ? data.updatedAt : null)
      } else {
        setUtilityError(data.error ?? 'Failed to load utility index')
      }
    } catch {
      setUtilityError('Failed to load utility index')
    }
    setUtilityLoading(false)
  }

  async function loadExternalBrief(accountId: ExternalBriefAccountId, pw: string) {
    setExternalLoading(prev => ({ ...prev, [accountId]: true }))
    setExternalResults(prev => ({ ...prev, [accountId]: null }))
    try {
      const res = await fetch('/api/admin/gitlawb-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', password: pw, accountId }),
      })
      const data = await res.json()
      if (data.ok) {
        setExternalBriefs(prev => ({ ...prev, [accountId]: data.brief ?? null }))
      } else {
        setExternalResults(prev => ({
          ...prev,
          [accountId]: data.error ?? `Failed to load ${accountId} brief`,
        }))
      }
    } catch {
      setExternalResults(prev => ({ ...prev, [accountId]: `Failed to load ${accountId} brief` }))
    }
    setExternalLoading(prev => ({ ...prev, [accountId]: false }))
  }

  async function regenerateExternalBrief(accountId: ExternalBriefAccountId) {
    setExternalRunning(prev => ({ ...prev, [accountId]: true }))
    setExternalResults(prev => ({ ...prev, [accountId]: null }))
    try {
      const res = await fetch('/api/admin/gitlawb-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate', password, accountId }),
      })
      const data = await res.json()
      if (data.ok) {
        setExternalBriefs(prev => ({ ...prev, [accountId]: data.brief ?? null }))
        setExternalResults(prev => ({
          ...prev,
          [accountId]:
            `Saved — ${data.repoCount ?? 0} repos, ${data.commitCount ?? 0} commits` +
            (data.brief?.general ? `. ${String(data.brief.general).slice(0, 120)}…` : ''),
        }))
      } else {
        setExternalResults(prev => ({
          ...prev,
          [accountId]: data.error ?? `${accountId} brief generation failed`,
        }))
      }
    } catch {
      setExternalResults(prev => ({ ...prev, [accountId]: `${accountId} brief request failed` }))
    }
    setExternalRunning(prev => ({ ...prev, [accountId]: false }))
  }

  useEffect(() => {
    if (!authed) return
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#utility') return
    const el = document.getElementById('utility')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [authed, utilityLoading])

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

  async function loadBehindStatus(): Promise<string[] | null> {
    try {
      const res = await fetch('/api/admin/rescore-behind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', password }),
      })
      const data = await res.json()
      if (data.ok) {
        const slugs = Array.isArray(data.slugs) ? (data.slugs as string[]) : []
        setBehindCount(typeof data.count === 'number' ? data.count : slugs.length)
        setBehindPreview(Array.isArray(data.preview) ? (data.preview as string[]) : slugs.slice(0, 20))
        return slugs
      }
      setBehindCount(null)
      setBehindPreview([])
      return null
    } catch {
      setBehindCount(null)
      setBehindPreview([])
      return null
    }
  }

  async function runBehindRescores() {
    setBehindRunning(true)
    setBehindResult(null)
    let totalScored = 0
    let totalFailed = 0
    const failedNames: string[] = []

    try {
      const slugs = await loadBehindStatus()
      if (!slugs || slugs.length === 0) {
        setBehindResult('Nothing behind — all scored repos look current vs GitHub activity.')
        setBehindRunning(false)
        return
      }

      const total = slugs.length
      setBehindResult(`Rescoring 0/${total}…`)

      for (let i = 0; i < slugs.length; i += BULK_REGEN_DEFAULT_BATCH) {
        const chunk = slugs.slice(i, i + BULK_REGEN_DEFAULT_BATCH)
        const isLast = i + BULK_REGEN_DEFAULT_BATCH >= slugs.length
        const res = await fetch('/api/admin/rescore-behind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch',
            password,
            slugs: chunk,
            limit: BULK_REGEN_DEFAULT_BATCH,
            refreshNeedle: isLast,
          }),
        })

        if (!res.ok) {
          const statusHint =
            res.status === 504
              ? 'Server timed out (504).'
              : `HTTP ${res.status}.`
          setBehindResult(
            `${statusHint} ${totalScored} of ${total} scored so far — click again to continue (safe).`,
          )
          break
        }

        let data: {
          ok?: boolean
          error?: string
          scored?: string[]
          failed?: Array<{ slug: string; error: string }>
        }
        try {
          data = await res.json()
        } catch {
          setBehindResult(
            `Bad response after ${totalScored} of ${total} — click again to continue (safe).`,
          )
          break
        }

        if (!data.ok) {
          setBehindResult(data.error ?? `Batch failed after ${totalScored} of ${total}`)
          break
        }

        totalScored += data.scored?.length ?? 0
        for (const f of data.failed ?? []) {
          totalFailed += 1
          failedNames.push(f.slug)
        }
        setBehindResult(
          `Rescoring ${Math.min(i + chunk.length, total)}/${total}… (${totalScored} ok${totalFailed ? `, ${totalFailed} failed` : ''})`,
        )
      }

      await loadBehindStatus()
      const failNote =
        failedNames.length > 0
          ? ` Failed: ${failedNames.slice(0, 8).join(', ')}${failedNames.length > 8 ? '…' : ''}.`
          : ''
      setBehindResult(
        `Done — ${totalScored} rescored${totalFailed ? `, ${totalFailed} failed` : ''}.${failNote} Needle refresh queued if any finished.`,
      )
    } catch {
      setBehindResult(
        `Request failed after ${totalScored} scored — click again to continue (safe).`,
      )
    }

    setBehindRunning(false)
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

  async function runSourceNormieBackfill() {
    setNormieBackfillRunning(true)
    setBulkResult(null)
    let offset = 0
    let totalRewritten = 0
    let totalFailed = 0
    const failedNames: string[] = []

    try {
      while (true) {
        const res = await fetch('/api/admin/bulk-regen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rewriteSourceNormies',
            password,
            offset,
            forceAll: false,
          }),
        })
        if (!res.ok) {
          setBulkResult(
            `PE rewrite HTTP ${res.status} after ${totalRewritten} repo(s) — retry to continue.`,
          )
          break
        }
        const data = await res.json()
        if (!data.ok) {
          setBulkResult(data.error ?? 'PE note rewrite failed')
          break
        }
        totalRewritten += (data.rewritten as string[] | undefined)?.length ?? 0
        totalFailed += (data.failed as string[] | undefined)?.length ?? 0
        failedNames.push(...((data.failed as string[] | undefined) ?? []))
        if (data.nextOffset == null) {
          setBulkResult(
            `PE notes rewritten for ${totalRewritten} cached repo(s)${
              totalFailed ? `, ${totalFailed} failed (${failedNames.slice(0, 5).join(', ')})` : ''
            }. Grades unchanged.`,
          )
          break
        }
        offset = data.nextOffset as number
        setBulkResult(
          `Rewriting PE notes… ${totalRewritten} done (${offset}/${data.totalCached}).`,
        )
      }
    } catch {
      setBulkResult('PE note rewrite request failed')
    }
    setNormieBackfillRunning(false)
  }

  async function loadContextList() {
    setContextListBusy(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listContext', password }),
      })
      const data = await res.json()
      if (data.ok) setContextList(Array.isArray(data.submissions) ? data.submissions : [])
      else setContextModResult(data.error ?? 'Could not load submissions')
    } catch {
      setContextModResult('Could not load submissions')
    }
    setContextListBusy(false)
  }

  async function moderateCommunityContext(mode: 'accept' | 'remove', id?: string) {
    const submissionId = (id ?? contextModId).trim()
    if (!submissionId) return
    setContextModBusy(`${mode}:${submissionId}`)
    setContextModResult(null)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode === 'accept' ? 'acceptContext' : 'removeContext',
          password,
          submissionId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setContextModResult(
          mode === 'accept'
            ? 'Accepted — the next paid rescore on that repo will read it.'
            : 'Removed — hidden from the card and the AI.',
        )
        if (!id) setContextModId('')
        void loadContextList()
      } else {
        setContextModResult(data.error ?? 'Not found')
      }
    } catch {
      setContextModResult('Request failed')
    }
    setContextModBusy(null)
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
      <AdminSectionNav />

      {/* CLAWD / CV utility ledger (moved from public /utility) */}
      <div id="admin-utility" className="admin-jump-target">
      <div id="utility" style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>CLAWD Utility</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px' }}>
              Plain-English CLAWD / CV use and last upgrade from public GitHub. Interpretive — not an official CLAWD product list.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadUtilityIndex(password)}
            disabled={utilityLoading}
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
            {utilityLoading ? 'Loading…' : 'Refresh ledger'}
          </button>
        </div>
        {utilityError && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            {utilityError}
          </div>
        )}
        {utilityLoading && utilityRows.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading utility index…</p>
        ) : (
          <UtilityLedger
            rows={utilityRows}
            enrichedCount={utilityEnriched}
            totalCount={utilityTotal}
            updatedAt={utilityUpdatedAt}
          />
        )}
      </div>
      </div>

      {/* GitHub data refresh */}
      <div id="admin-github" className="admin-jump-target" style={{ marginBottom: '32px' }}>
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

      {/* Build brief */}
      <div id="admin-brief" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Build brief</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px' }}>
              Daily AI summary of commits on the previous Mountain calendar day (midnight–midnight America/Denver). Regenerates automatically overnight Mountain; use this to refresh immediately after a GitHub scan.
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

      {/* Secondary-account Yesterday's Builds — newspaper desk */}
      <div id="admin-builds" className="admin-jump-target">
      <YbLeadStoryLab briefs={externalBriefs} />
      <ExternalBriefsNewspaper
        admin
        briefs={externalBriefs}
        loading={externalLoading}
        running={externalRunning}
        results={externalResults}
        onRegenerate={id => void regenerateExternalBrief(id)}
      />
      </div>

      {/* The Wire — MCP registry */}
      <div id="admin-wire" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div id="wire" />
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>The Wire</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '620px', lineHeight: 1.55 }}>
              New tools published to the public MCP registry since the last successful collection. Runs automatically with the nightly digest; use this to pull immediately. Running it twice in a row should return almost nothing — that means the watermark is working.
            </p>
          </div>
          <button
            onClick={refreshMcpWire}
            disabled={wireRunning}
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
            {wireRunning ? 'Pulling…' : 'Refresh wire'}
          </button>
        </div>
        {wireResult && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            {wireResult}
          </div>
        )}
        <McpWireInbox record={wireAdmin} />
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '16px 0 8px' }}>
          Newspaper desk preview — Admin only. Not on the live Yesterday’s Builds page. Inbox above stays the full newsroom view.
        </p>
        <McpWire wire={wireAdmin?.snapshot ?? null} preview />
      </div>

      {/* Catch up stale scores — not the same as Autoscore */}
      <div id="admin-rescore" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
            Behind — catch up stale scores
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '560px', lineHeight: 1.55 }}>
            For scored repos with new GitHub commits since last score (homepage{' '}
            <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Awaiting overnight</strong>
            ). Updates grades + What changed. Refresh GitHub data first.
            {' '}
            <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              Not Autoscore
            </strong>
            {' '}
            — that only scores never-scored repos (nav → Autoscore).
          </p>
        </div>

        <div
          style={{
            padding: '14px 16px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Catch up all behind
            {behindCount != null ? ` · ${behindCount} repo${behindCount === 1 ? '' : 's'}` : ''}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 12px', maxWidth: '520px' }}>
            Same free pipeline as overnight — batches of {BULK_REGEN_DEFAULT_BATCH}. Safe to click again after a timeout.
          </p>
          {behindPreview.length > 0 && (
            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginBottom: '12px',
                lineHeight: 1.45,
                wordBreak: 'break-all',
              }}
            >
              {behindPreview.join(', ')}
              {behindCount != null && behindCount > behindPreview.length ? '…' : ''}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void runBehindRescores()}
              disabled={behindRunning || adminRescoreRunning || behindCount === 0}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                padding: '10px 18px',
                borderRadius: 'var(--radius)',
                background: behindCount && behindCount > 0 ? 'var(--accent-dim)' : 'var(--surface-3)',
                color: behindCount && behindCount > 0 ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${behindCount && behindCount > 0 ? 'var(--accent-border)' : 'var(--border-strong)'}`,
              }}
            >
              {behindRunning
                ? 'Catching up…'
                : behindCount === 0
                  ? 'Nothing behind'
                  : `Catch up all behind${behindCount != null ? ` (${behindCount})` : ''}`}
            </button>
            <button
              type="button"
              onClick={() => void loadBehindStatus()}
              disabled={behindRunning}
              style={{
                fontSize: '12px',
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
              }}
            >
              Refresh count
            </button>
          </div>
          {behindResult && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>
              {behindResult}
            </div>
          )}
        </div>

        <div style={{ marginTop: '4px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>
            One repo
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.45 }}>
            Free Score/Rescore for a single slug (owner/repo).
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={adminRescoreSlug}
              onChange={e => setAdminRescoreSlug(e.target.value)}
              placeholder="owner/repo"
              style={{
                fontSize: '13px',
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                minWidth: '220px',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <button
              type="button"
              onClick={() => void runAdminRescore()}
              disabled={adminRescoreRunning || behindRunning}
              style={{
                fontSize: '12px',
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
              }}
            >
              {adminRescoreRunning ? 'Scoring…' : 'Rescore this repo'}
            </button>
          </div>
          {adminRescoreResult && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>
              {adminRescoreResult}
            </div>
          )}
        </div>
        <AdminBackToNav />
      </div>

      {/* Needle */}
      <div id="admin-needle" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>The Needle</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px' }}>
              Short holder-focused column from overnight rescores + Yesterday&apos;s Build activity. Regenerates with the daily digest; use this to refresh after a manual rescore.
            </p>
          </div>
          <button
            onClick={regenerateNeedle}
            disabled={needleRunning}
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
            {needleRunning ? 'Generating…' : 'Regenerate needle'}
          </button>
        </div>
        {needleResult && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            {needleResult}
          </div>
        )}
      </div>

      <AdminStarterKitShare />

      {/* Overheard — podcast mentions */}
      <div id="admin-overheard" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Overheard (podcast mentions)</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px' }}>
              Scans new Slop.Computer episode transcripts for mentions of tracked repos. Runs automatically daily at 5:20am ET; use this to scan immediately.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={() => void runPodcastScan('scanOne')}
              disabled={podcastScanRunning}
              style={{
                fontSize: '12px',
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
              }}
            >
              {podcastScanRunning ? 'Scanning…' : 'Scan next episode'}
            </button>
            <button
              onClick={() => void runPodcastScan('scanAll')}
              disabled={podcastScanRunning}
              style={{
                fontSize: '12px',
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
              }}
            >
              {podcastScanRunning ? 'Scanning…' : 'Scan all new'}
            </button>
            <button
              onClick={() => {
                if (window.confirm('Clear the scanned-episode cache? Episodes will be treated as unscanned again. Does not delete pending/published mentions.')) {
                  void runPodcastScan('clearHistory')
                }
              }}
              disabled={podcastScanRunning}
              style={{
                fontSize: '12px',
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
              }}
            >
              Clear scan history
            </button>
          </div>
        </div>
        {podcastScanResult && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            {podcastScanResult}
          </div>
        )}
      </div>

      {/* Podcast mentions review */}
      <div id="admin-podcast-review" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div id="podcast-review" />
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Podcast mentions review</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '620px', lineHeight: 1.6 }}>
              <strong>Automatic</strong>: Haiku auto-confirms matches, they land directly in the pending queue below. <strong>Manual</strong>: raw keyword matches show as candidates first — add context and confirm yourself before they reach pending.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => void setOverheardMode('automatic')}
              disabled={modeSaving}
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                borderRadius: 'var(--radius)',
                background: overheardMode === 'automatic' ? 'var(--accent-dim)' : 'var(--surface-3)',
                color: overheardMode === 'automatic' ? 'var(--accent)' : 'var(--text-secondary)',
                border: `1px solid ${overheardMode === 'automatic' ? 'var(--accent-border)' : 'var(--border)'}`,
              }}
            >
              Automatic
            </button>
            <button
              onClick={() => void setOverheardMode('manual')}
              disabled={modeSaving}
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                borderRadius: 'var(--radius)',
                background: overheardMode === 'manual' ? 'var(--accent-dim)' : 'var(--surface-3)',
                color: overheardMode === 'manual' ? 'var(--accent)' : 'var(--text-secondary)',
                border: `1px solid ${overheardMode === 'manual' ? 'var(--accent-border)' : 'var(--border)'}`,
              }}
            >
              Manual
            </button>
          </div>
        </div>

        <button
          onClick={() => void loadMentionsReview()}
          disabled={mentionsListLoading}
          style={{
            fontSize: '12px',
            padding: '6px 14px',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-2)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            marginBottom: '16px',
          }}
        >
          {mentionsListLoading ? 'Loading…' : 'Load candidates, pending & published'}
        </button>

        {publishedMentions.filter(m => m.status === 'published').length > 0 && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
              Published live ({publishedMentions.filter(m => m.status === 'published').length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {publishedMentions.filter(m => m.status === 'published').map(m => (
                <OverheardAdminEntryCard
                  key={m.id}
                  entry={m}
                  editing={editingMentionIds.includes(m.id)}
                  draft={mentionEditDrafts[m.id] ?? mentionToEditDraft(m)}
                  busyKey={mentionActionBusy}
                  onDraftChange={draft => setMentionEditDrafts(prev => ({ ...prev, [m.id]: draft }))}
                  onToggleEdit={() => toggleMentionEdit(m.id, m)}
                  onSave={() => void saveMentionEdit(m.id)}
                  onTakeDown={() => void takeDownPublished(m.id)}
                  onRemoveFromArchives={() => void removePublishedFromArchives(m.id)}
                  onMoveToPending={() => void movePublishedToPending(m.id)}
                />
              ))}
            </div>
          </>
        )}

        {publishedMentions.filter(m => m.status === 'archived').length > 0 && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
              In archives only ({publishedMentions.filter(m => m.status === 'archived').length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {publishedMentions.filter(m => m.status === 'archived').map(m => (
                <OverheardAdminEntryCard
                  key={m.id}
                  entry={m}
                  editing={editingMentionIds.includes(m.id)}
                  draft={mentionEditDrafts[m.id] ?? mentionToEditDraft(m)}
                  busyKey={mentionActionBusy}
                  onDraftChange={draft => setMentionEditDrafts(prev => ({ ...prev, [m.id]: draft }))}
                  onToggleEdit={() => toggleMentionEdit(m.id, m)}
                  onSave={() => void saveMentionEdit(m.id)}
                  onRemoveFromArchives={() => void removePublishedFromArchives(m.id)}
                  onMoveToPending={() => void movePublishedToPending(m.id)}
                />
              ))}
            </div>
          </>
        )}

        {candidateMentions.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>
                Candidates awaiting context ({candidateMentions.length})
              </div>
              {selectedCandidateIds.length >= 2 && (
                <button
                  onClick={() => void groupSelectedCandidates()}
                  disabled={mentionActionBusy === 'group-thread'}
                  style={{
                    fontSize: '11px',
                    padding: '5px 12px',
                    borderRadius: '99px',
                    border: '1px solid var(--accent-border)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    fontWeight: 500,
                  }}
                >
                  {mentionActionBusy === 'group-thread' ? 'Grouping…' : `Group into thread (${selectedCandidateIds.length})`}
                </button>
              )}
            </div>
            {groupThreadError && (
              <p style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '8px' }}>{groupThreadError}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {candidateMentions.map(m => {
                const quote = m.quotes[0]
                const selected = selectedCandidateIds.includes(m.id)
                return (
                <div key={m.id} style={{ background: 'var(--surface-1)', border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '4px' }}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCandidateSelection(m.id)}
                      style={{ marginTop: '2px' }}
                      aria-label={`Select ${m.repoSlug} candidate`}
                    />
                    <div style={{ flex: 1, fontSize: '12px', color: 'var(--text-muted)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{m.repoSlug}</strong> · {m.episodeName} · {quote?.speaker ?? 'unknown'}
                    </div>
                  </div>
                  {m.episodeUrl && (
                    <a
                      href={m.episodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', display: 'block', marginBottom: '8px', paddingLeft: '26px' }}
                    >
                      Episode link ↗
                    </a>
                  )}
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5, paddingLeft: '26px' }}>
                    &ldquo;{quote?.text ?? ''}&rdquo;
                  </div>
                  <textarea
                    value={candidateContextDrafts[m.id] ?? m.userContext ?? ''}
                    onChange={e => setCandidateContextDrafts(prev => ({ ...prev, [m.id]: e.target.value }))}
                    placeholder="Add context (optional)..."
                    rows={2}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '13px',
                      fontFamily: 'var(--font-sans)', resize: 'vertical', marginBottom: '8px',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => void addContextToCandidate(m.id)}
                      disabled={mentionActionBusy === m.id}
                      style={{ fontSize: '11px', padding: '5px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                    >
                      Save context
                    </button>
                    <button
                      onClick={() => void confirmCandidate(m.id)}
                      disabled={mentionActionBusy === m.id}
                      style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '99px', border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 500 }}
                    >
                      {mentionActionBusy === m.id ? 'Generating…' : 'Confirm → pending'}
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          </>
        )}

        {pendingMentions.length === 0 && candidateMentions.length === 0 && publishedMentions.length === 0 && !mentionsListLoading && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nothing loaded. Click the button above.</p>
        )}

        {pendingMentions.length > 0 && (
          <>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
              Pending publish ({pendingMentions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingMentions.map(m => (
                <OverheardAdminEntryCard
                  key={m.id}
                  entry={m}
                  editing={editingMentionIds.includes(m.id)}
                  draft={mentionEditDrafts[m.id] ?? mentionToEditDraft(m)}
                  busyKey={mentionActionBusy}
                  onDraftChange={draft => setMentionEditDrafts(prev => ({ ...prev, [m.id]: draft }))}
                  onToggleEdit={() => toggleMentionEdit(m.id, m)}
                  onSave={() => void saveMentionEdit(m.id)}
                  onPublish={() => void actOnPendingMention(m.id, 'publish')}
                  onDismiss={() => void actOnPendingMention(m.id, 'dismiss')}
                  onRegenerateWriteup={() => void regeneratePendingWriteup(m.id)}
                  showPublish
                  showDismiss
                  showRegenerate
                />
              ))}
            </div>
          </>
        )}
        <AdminBackToNav />
      </div>

      {/* Spotted — X mentions */}
      <div id="admin-spotted" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div id="spotted" />
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Spotted (X mentions)</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '620px', lineHeight: 1.6 }}>
            Paste a tweet manually. Generate a draft, review the write-up and embed, then publish separately.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '620px', marginBottom: '16px' }}>
          <input
            value={spottedTweetUrl}
            onChange={e => setSpottedTweetUrl(e.target.value)}
            placeholder="Tweet URL"
            style={{ fontSize: '13px', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
          />
          <textarea
            value={spottedTweetText}
            onChange={e => setSpottedTweetText(e.target.value)}
            placeholder="Tweet text (paste manually)"
            rows={2}
            style={{ fontSize: '13px', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)', resize: 'vertical' }}
          />
          <textarea
            value={spottedAccountContext}
            onChange={e => setSpottedAccountContext(e.target.value)}
            placeholder="Who is this account? (from Grok or your own research)"
            rows={2}
            style={{ fontSize: '13px', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)', resize: 'vertical' }}
          />
          <textarea
            value={spottedExtraContext}
            onChange={e => setSpottedExtraContext(e.target.value)}
            placeholder="Add context (optional — anything else worth including)"
            rows={2}
            style={{ fontSize: '13px', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)', resize: 'vertical' }}
          />
          <select
            value={spottedRepoSlug}
            onChange={e => setSpottedRepoSlug(e.target.value)}
            style={{ fontSize: '13px', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-primary)' }}
          >
            <option value="">No specific repo</option>
            {REPOS.map(r => (
              <option key={r.githubSlug} value={r.githubSlug}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={() => void generateSpottedDraft()}
            disabled={spottedGenerating || !spottedTweetUrl || !spottedTweetText}
            style={{
              fontSize: '12px', padding: '8px 16px', borderRadius: 'var(--radius)',
              background: 'var(--surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)',
              alignSelf: 'flex-start',
            }}
          >
            {spottedGenerating ? 'Generating…' : 'Generate draft'}
          </button>
        </div>

        {spottedDraft && (
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: '16px', maxWidth: '620px' }}>
            <textarea
              value={spottedDraft.writeup}
              onChange={e => setSpottedDraft(prev => prev ? { ...prev, writeup: e.target.value } : null)}
              rows={5}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                lineHeight: 1.6,
                fontFamily: 'var(--font-sans)',
                resize: 'vertical',
                marginBottom: '10px',
              }}
            />
            <div dangerouslySetInnerHTML={{ __html: spottedDraft.embedHtml }} />
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <button
                onClick={() => void actOnSpottedDraft(spottedDraft.id, 'publish')}
                disabled={spottedActionBusy === spottedDraft.id}
                style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '99px', border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 500 }}
              >
                Publish
              </button>
              <button
                onClick={() => void actOnSpottedDraft(spottedDraft.id, 'dismiss')}
                disabled={spottedActionBusy === spottedDraft.id}
                style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '99px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => void loadSpottedDrafts()}
          style={{ fontSize: '12px', padding: '6px 14px', borderRadius: 'var(--radius)', background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          Load drafts &amp; published
        </button>

        {spottedPublishedList.filter(d => d.status !== 'archived').length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
              Published live ({spottedPublishedList.filter(d => d.status !== 'archived').length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {spottedPublishedList.filter(d => d.status !== 'archived').map(d => (
                <div
                  key={d.id}
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{d.authorName}</strong>
                    {d.publishedAt && (
                      <> · published {new Date(d.publishedAt).toLocaleString()}</>
                    )}
                    {' · '}
                    <a href={d.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      tweet
                    </a>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 10px' }}>
                    {d.writeup}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => void takeDownSpotted(d.id)}
                      disabled={spottedActionBusy === d.id}
                      style={{
                        fontSize: '11px',
                        padding: '5px 12px',
                        borderRadius: 'var(--radius)',
                        background: 'var(--surface-3)',
                        color: 'var(--red, #c44)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {spottedActionBusy === d.id ? 'Working…' : 'Take down'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSpottedFromArchives(d.id)}
                      disabled={spottedActionBusy === d.id}
                      style={{
                        fontSize: '11px',
                        padding: '5px 12px',
                        borderRadius: 'var(--radius)',
                        background: 'var(--surface-3)',
                        color: 'var(--red, #c44)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      Take down from archives
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {spottedPublishedList.filter(d => d.status === 'archived').length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
              In archives only ({spottedPublishedList.filter(d => d.status === 'archived').length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {spottedPublishedList.filter(d => d.status === 'archived').map(d => (
                <div
                  key={d.id}
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{d.authorName}</strong>
                    {d.publishedAt && (
                      <> · published {new Date(d.publishedAt).toLocaleString()}</>
                    )}
                    {' · '}
                    <a href={d.tweetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      tweet
                    </a>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 10px' }}>
                    {d.writeup}
                  </p>
                  <button
                    type="button"
                    onClick={() => void removeSpottedFromArchives(d.id)}
                    disabled={spottedActionBusy === d.id}
                    style={{
                      fontSize: '11px',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius)',
                      background: 'var(--surface-3)',
                      color: 'var(--red, #c44)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {spottedActionBusy === d.id ? 'Working…' : 'Take down from archives'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {spottedDraftsList.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '0', color: 'var(--text-secondary)' }}>
              Drafts ({spottedDraftsList.length})
            </h3>
            {spottedDraftsList.map(d => (
              <div key={d.id} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px' }}>
                <textarea
                  value={d.writeup}
                  onChange={e => setSpottedDraftsList(prev => prev.map(item => item.id === d.id ? { ...item, writeup: e.target.value } : item))}
                  rows={5}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    fontFamily: 'var(--font-sans)',
                    resize: 'vertical',
                    marginBottom: '8px',
                  }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => void actOnSpottedDraft(d.id, 'publish')}
                    disabled={spottedActionBusy === d.id}
                    style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '99px', border: '1px solid var(--accent-border)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 500 }}
                  >
                    Publish
                  </button>
                  <button
                    onClick={() => void actOnSpottedDraft(d.id, 'dismiss')}
                    disabled={spottedActionBusy === d.id}
                    style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '99px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <AdminBackToNav />
      </div>

      {/* Scoring context (Chronicle-grounded) */}
      <div id="admin-scoring-context" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Scoring context</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '640px' }}>
            Chronicle-grounded handbook prepended to all autoscore and rescore prompts — rules, repo cheat sheet, and
            timeline. Leave empty to use the built-in default.
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
            {savingEcosystem ? 'Saving…' : ecosystemSaved ? 'Saved ✓' : 'Save scoring context'}
          </button>
        </div>
      </div>

      {/* Community context moderation — launch fast-track + emergency kill-switch */}
      <div id="admin-community" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Community context</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '640px', lineHeight: 1.6 }}>
            Community votes normally decide acceptance. Load the list below to moderate with one click, or paste a submission
            ID. Both overrides are logged: <strong>Accept</strong> is a launch fast-track so context can ground a rescore
            before there are enough voters; <strong>Force-remove</strong> is the emergency kill-switch that hides a submission
            from the card and future AI rescores.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', maxWidth: '620px', flexWrap: 'wrap' }}>
          <input
            value={contextModId}
            onChange={e => setContextModId(e.target.value)}
            placeholder="submission id"
            style={{
              flex: 1,
              minWidth: '220px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              padding: '6px 10px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="button"
            onClick={() => void moderateCommunityContext('accept')}
            disabled={!contextModId.trim() || contextModBusy !== null}
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
            }}
          >
            {contextModBusy?.startsWith('accept') ? 'Accepting…' : 'Accept'}
          </button>
          <button
            type="button"
            onClick={() => void moderateCommunityContext('remove')}
            disabled={!contextModId.trim() || contextModBusy !== null}
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-3)',
              color: 'var(--red)',
              border: '1px solid var(--border-strong)',
            }}
          >
            {contextModBusy?.startsWith('remove') ? 'Removing…' : 'Force-remove'}
          </button>
        </div>
        {contextModResult && (
          <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>{contextModResult}</div>
        )}

        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => void loadContextList()}
            disabled={contextListBusy}
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {contextListBusy ? 'Loading…' : contextList.length ? 'Reload submissions' : 'Load submissions'}
          </button>

          {contextList.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {contextList.map(sub => {
                const acceptKey = `accept:${sub.id}`
                const removeKey = `remove:${sub.id}`
                const stateColor =
                  sub.state === 'accepted'
                    ? 'var(--accent)'
                    : sub.state === 'pending'
                      ? 'var(--amber)'
                      : 'var(--text-muted)'
                return (
                  <div
                    key={sub.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: stateColor, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {sub.state}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{sub.slug}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>▲{sub.upvotes} ▼{sub.downvotes}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '4px' }}>{sub.text}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{sub.id}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => void moderateCommunityContext('accept', sub.id)}
                        disabled={contextModBusy !== null || sub.state === 'accepted' || sub.state === 'removed'}
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius)',
                          background: 'var(--accent-dim)',
                          color: 'var(--accent)',
                          border: '1px solid var(--accent-border)',
                        }}
                      >
                        {contextModBusy === acceptKey ? 'Accepting…' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void moderateCommunityContext('remove', sub.id)}
                        disabled={contextModBusy !== null || sub.state === 'removed'}
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius)',
                          background: 'var(--surface-3)',
                          color: 'var(--red)',
                          border: '1px solid var(--border-strong)',
                        }}
                      >
                        {contextModBusy === removeKey ? 'Removing…' : 'Force-remove'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <AdminBackToNav />
      </div>

      {/* Filter collections — homepage repo filters */}
      <div id="admin-filters" className="admin-jump-target" style={{ marginBottom: '32px' }}>
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

      {/* Scoring v2 — bulk regenerate */}
      <div id="admin-bulk" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Bulk regenerate (Live AI)</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '620px', lineHeight: 1.6 }}>
            Download a baseline backup before flushing. Scores {BULK_REGEN_DEFAULT_BATCH} repos per request to avoid server timeouts — the button runs until all are done.
            Bulk flush replaces cached Live AI scores with the current v3 prompt and rubrics.
            “Rewrite stale PE notes” only refreshes Plain English score blurbs (no grade changes).
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
            disabled={bulkRunning || normieBackfillRunning}
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
          <button
            onClick={() => void runSourceNormieBackfill()}
            disabled={bulkRunning || normieBackfillRunning}
            style={{
              fontSize: '12px',
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-3)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
            title="Rewrites long/jargony Plain English score notes only — does not change grades"
          >
            {normieBackfillRunning ? 'Rewriting PE…' : 'Rewrite stale PE notes (no rescore)'}
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
          disabled={bulkRunning || normieBackfillRunning || !bulkFlushAck || !backupDownloaded}
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
        <AdminBackToNav />
      </div>

      {/* Auto-scored repos */}
      <div id="admin-scores" className="admin-jump-target" style={{ marginBottom: '32px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>Autoscore (never scored)</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '520px' }}>
              Only for repos with <strong style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>no score yet</strong>.
              Unscored GitHub repos are inferred and cached in Redis. For already-scored cards with new commits, use nav →{' '}
              <strong style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Behind</strong> instead.
              On Vercel Hobby, autoscore also runs once daily via cron (up to 15 repos per run).
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
    </div>
  )
}
