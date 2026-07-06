'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSendTransaction, useSignMessage } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { base } from 'wagmi/chains'
import { wagmiConfig } from '@/lib/wagmi/config'
import { CONTEXT_SUBMIT_WEI, RECEIVER_BUY_AND_BURN } from '@/lib/web3/constants'
import { useClawdAccess } from '@/components/wallet/ClawdAccessContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MIN_TAP } from '@/lib/responsive'
import InfoTooltip from '@/components/InfoTooltip'
import {
  NO_SOURCE_LABEL,
  SOURCE_MAX,
  TEXT_MAX,
  voteMessage,
  type CommunityContextPublic,
  type ContextState,
  type VoteDirection,
} from '@/lib/communityContextTypes'

const SUBMIT_ETH = Number(CONTEXT_SUBMIT_WEI) / 1e18
const SUBMIT_ETH_LABEL = SUBMIT_ETH.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')

const DISCLOSURE =
  'Holders can submit and vote on context the AI reads on the next paid rescore. Enough net upvotes auto-accepts it. Every submission and its votes are public and permanently logged. Accepted context is grounding the AI weighs — not a direct score override.'

const STATE_STYLE: Record<ContextState, { label: string; color: string; bg: string }> = {
  accepted: { label: 'accepted', color: '#5cb87a', bg: 'rgba(92,184,122,0.12)' },
  pending: { label: 'pending', color: 'var(--amber)', bg: 'rgba(212,148,58,0.1)' },
  rejected: { label: 'rejected by community', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
  removed: { label: 'removed', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
}

function stateRank(s: ContextState): number {
  if (s === 'accepted') return 0
  if (s === 'pending') return 1
  return 2
}

interface Props {
  repoSlug: string
  enabled: boolean
}

export default function CommunityContextSection({ repoSlug, enabled }: Props) {
  const isMobile = useIsMobile()
  const { isConnected, hasAccess, connectWallet, address, isWrongChain, switchToBase } = useClawdAccess()
  const { sendTransactionAsync } = useSendTransaction()
  const { signMessageAsync } = useSignMessage()

  const [items, setItems] = useState<CommunityContextPublic[]>([])
  const [voteTotalMin, setVoteTotalMin] = useState(2)
  const [loaded, setLoaded] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [phase, setPhase] = useState<'idle' | 'paying' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [votingId, setVotingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ slug: repoSlug })
      if (address) q.set('wallet', address)
      const res = await fetch(`/api/community-context?${q.toString()}`)
      const data = await res.json()
      if (data.ok) {
        setItems(Array.isArray(data.submissions) ? data.submissions : [])
        if (typeof data.voteTotalMin === 'number') setVoteTotalMin(data.voteTotalMin)
      }
    } catch {
      // best-effort; leave prior state
    } finally {
      setLoaded(true)
    }
  }, [repoSlug, address])

  useEffect(() => {
    if (enabled) void load()
  }, [enabled, load])

  const gateCheck = useCallback((): boolean => {
    setError(null)
    setNotice(null)
    if (!isConnected) {
      connectWallet()
      return false
    }
    if (isWrongChain) {
      switchToBase()
      return false
    }
    if (!hasAccess) {
      setError('Hold 10M $CLAWD to submit or vote')
      return false
    }
    return true
  }, [isConnected, isWrongChain, hasAccess, connectWallet, switchToBase])

  async function handleSubmit() {
    if (!gateCheck() || !address) return
    const trimmed = text.trim()
    if (!trimmed) {
      setError('Context cannot be empty')
      return
    }
    try {
      setPhase('paying')
      const hash = await sendTransactionAsync({
        to: RECEIVER_BUY_AND_BURN,
        value: CONTEXT_SUBMIT_WEI,
        chainId: base.id,
      })
      setPhase('saving')
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
      if (receipt.status !== 'success') throw new Error('Transaction failed')

      const res = await fetch('/api/community-context/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoSlug,
          txHash: hash,
          walletAddress: address,
          text: trimmed,
          source: source.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Submission failed')

      setItems(prev => [data.submission as CommunityContextPublic, ...prev])
      setText('')
      setSource('')
      setFormOpen(false)
      setNotice(
        voteTotalMin > 1
          ? `Context submitted — that counts as your upvote (1/${voteTotalMin}). ${voteTotalMin - 1} more holder upvote${voteTotalMin - 1 === 1 ? '' : 's'} accepts it.`
          : 'Context submitted and accepted — it applies on the next rescore.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPhase('idle')
    }
  }

  async function handleVote(id: string, direction: VoteDirection) {
    if (!gateCheck() || !address) return
    try {
      setVotingId(id)
      const signature = await signMessageAsync({ message: voteMessage(id, direction) })
      const res = await fetch('/api/community-context/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: id, direction, walletAddress: address, signature }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Vote failed')
      setItems(prev => prev.map(it => (it.id === id ? (data.submission as CommunityContextPublic) : it)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record vote')
    } finally {
      setVotingId(null)
    }
  }

  if (!enabled) return null

  const busy = phase !== 'idle'
  const sorted = [...items].sort((a, b) => {
    const r = stateRank(a.state) - stateRank(b.state)
    if (r !== 0) return r
    return b.createdAt.localeCompare(a.createdAt)
  })

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Community context
        </div>
        <InfoTooltip content={DISCLOSURE} ariaLabel="About community context" icon="question" width={260} compact />
      </div>

      <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
        How it works: submit context (counts as your upvote) → {voteTotalMin > 1 ? `${voteTotalMin} net upvotes accept it` : 'accepted on submit'} → the AI reads accepted context on the next paid rescore.
      </p>

      {loaded && sorted.length === 0 && (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.4 }}>
          No community context yet. Holders can add real-world context the AI reads on the next rescore — e.g. &ldquo;Incinerator is live again as of Jul 4, burning daily.&rdquo;
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sorted.map(item => {
          const st = STATE_STYLE[item.state]
          const isAccepted = item.state === 'accepted'
          const isVoting = votingId === item.id
          return (
            <div
              key={item.id}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius)',
                border: `1px solid ${isAccepted ? 'var(--accent-border)' : 'var(--border)'}`,
                background: isAccepted ? 'var(--accent-dim)' : 'var(--surface-2)',
                opacity: item.state === 'rejected' ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{ fontSize: '9px', fontWeight: 500, padding: '1px 6px', borderRadius: '99px', color: st.color, background: st.bg, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {st.label}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {item.walletMasked}
                </span>
                {item.consumedByRescoreAt && (
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>· read on rescore</span>
                )}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {item.text}
              </div>

              <div style={{ fontSize: '10px', marginTop: '4px', color: item.source ? 'var(--text-muted)' : 'var(--amber)' }}>
                {item.source ? `Source: ${item.source}` : NO_SOURCE_LABEL}
              </div>

              {item.consumedByRescoreAt && (
                <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--text-muted)', lineHeight: 1.4, fontFamily: 'var(--font-mono)' }}>
                  Grade when submitted: {item.scoreAtSubmit.economicLabel ?? 'N/A'} · BI {item.scoreAtSubmit.builderIntegrity}
                  <span style={{ fontFamily: 'var(--font-sans)' }}> — current grade above incorporates this context.</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleVote(item.id, 'up')}
                  disabled={isVoting || busy}
                  aria-label="Upvote this context"
                  style={{
                    fontSize: '11px',
                    padding: isMobile ? '6px 10px' : '3px 8px',
                    minHeight: isMobile ? MIN_TAP : undefined,
                    borderRadius: '99px',
                    border: `1px solid ${item.viewerVote === 'up' ? 'var(--accent-border)' : 'var(--border)'}`,
                    background: item.viewerVote === 'up' ? 'var(--accent-dim)' : 'transparent',
                    color: item.viewerVote === 'up' ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: isVoting || busy ? 'wait' : 'pointer',
                  }}
                >
                  ▲ {item.upvotes}
                </button>
                <button
                  type="button"
                  onClick={() => handleVote(item.id, 'down')}
                  disabled={isVoting || busy}
                  aria-label="Downvote this context"
                  style={{
                    fontSize: '11px',
                    padding: isMobile ? '6px 10px' : '3px 8px',
                    minHeight: isMobile ? MIN_TAP : undefined,
                    borderRadius: '99px',
                    border: `1px solid ${item.viewerVote === 'down' ? 'var(--border-strong)' : 'var(--border)'}`,
                    background: item.viewerVote === 'down' ? 'var(--surface-3)' : 'transparent',
                    color: item.viewerVote === 'down' ? 'var(--text-secondary)' : 'var(--text-muted)',
                    cursor: isVoting || busy ? 'wait' : 'pointer',
                  }}
                >
                  ▼ {item.downvotes}
                </button>
                {item.state === 'pending' && voteTotalMin > 1 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {Math.min(item.upvotes, voteTotalMin)}/{voteTotalMin} upvotes to accept
                  </span>
                )}
              </div>

              {isAccepted && !item.consumedByRescoreAt && (
                <div style={{ fontSize: '10px', marginTop: '6px', color: 'var(--accent)', lineHeight: 1.4, fontWeight: 500 }}>
                  ↑ Accepted — rescore this repo to apply it to the grade.
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!formOpen ? (
        <button
          type="button"
          onClick={() => {
            if (!gateCheck()) return
            setFormOpen(true)
          }}
          style={{
            marginTop: '8px',
            fontSize: '11px',
            padding: isMobile ? '8px 12px' : '4px 10px',
            minHeight: isMobile ? MIN_TAP : undefined,
            borderRadius: '99px',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Submit context (burn {SUBMIT_ETH_LABEL} ETH)
        </button>
      ) : (
        <div style={{ marginTop: '8px', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, TEXT_MAX))}
            placeholder="Real-world context the AI should weigh (e.g. 'Incinerator is live again as of Jul 4')."
            rows={3}
            style={{
              width: '100%',
              fontSize: '12px',
              padding: '8px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface-1)',
              color: 'var(--text-primary)',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ textAlign: 'right', fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {text.length}/{TEXT_MAX}
          </div>
          <input
            value={source}
            onChange={e => setSource(e.target.value.slice(0, SOURCE_MAX))}
            placeholder="Link or citation (optional but encouraged)"
            style={{
              width: '100%',
              fontSize: '12px',
              padding: '8px',
              marginTop: '6px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface-1)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              style={{
                fontSize: '11px',
                padding: isMobile ? '8px 12px' : '4px 10px',
                minHeight: isMobile ? MIN_TAP : undefined,
                borderRadius: '99px',
                border: '1px solid var(--accent-border)',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                fontWeight: 500,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {phase === 'paying' ? 'Paying…' : phase === 'saving' ? 'Saving…' : `Burn ${SUBMIT_ETH_LABEL} ETH & submit`}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false)
                setError(null)
              }}
              disabled={busy}
              style={{
                fontSize: '11px',
                padding: isMobile ? '8px 12px' : '4px 10px',
                minHeight: isMobile ? MIN_TAP : undefined,
                borderRadius: '99px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 }}>
            Submitting counts as your upvote. {voteTotalMin > 1 ? `${voteTotalMin - 1} more holder upvote${voteTotalMin - 1 === 1 ? '' : 's'} accepts it.` : 'It is accepted immediately.'} Your submission and its votes are public and permanently logged.
          </div>
        </div>
      )}

      {notice && (
        <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '6px', lineHeight: 1.3 }}>{notice}</div>
      )}
      {error && (
        <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: '6px', lineHeight: 1.3 }}>{error}</div>
      )}
    </div>
  )
}
