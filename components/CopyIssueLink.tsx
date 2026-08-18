'use client'

import { useState } from 'react'

/** Copies the canonical dated issue URL (absolute). */
export default function CopyIssueLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard may be blocked; leave label unchanged */
    }
  }

  return (
    <button type="button" className="yb-issue-nav__copy" onClick={() => void copy()}>
      {copied ? '✓ Link copied' : 'Copy issue link'}
    </button>
  )
}
