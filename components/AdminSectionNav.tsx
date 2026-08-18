'use client'

import { useEffect, useState } from 'react'

import { resolveAdminSectionId } from '@/lib/adminNav'

type NavLink = { href: string; label: string; id: string }

type NavGroup = { heading: string; links: NavLink[] }

const GROUPS: NavGroup[] = [
  {
    heading: 'Newsroom',
    links: [
      { href: '#admin-builds', label: 'Builds', id: 'admin-builds' },
      { href: '#admin-wire', label: 'Wire', id: 'admin-wire' },
      { href: '#admin-brief', label: 'Brief', id: 'admin-brief' },
      { href: '#admin-needle', label: 'Needle', id: 'admin-needle' },
      { href: '#admin-overheard', label: 'Overheard', id: 'admin-overheard' },
      { href: '#admin-podcast-review', label: 'Podcast', id: 'admin-podcast-review' },
      { href: '#admin-spotted', label: 'Spotted', id: 'admin-spotted' },
    ],
  },
  {
    heading: 'Data / Ops',
    links: [
      { href: '#admin-github', label: 'GitHub', id: 'admin-github' },
      { href: '#utility', label: 'Utility', id: 'utility' },
    ],
  },
  {
    heading: 'Scoring',
    links: [
      { href: '#admin-scoring-context', label: 'Scoring', id: 'admin-scoring-context' },
      { href: '#admin-community', label: 'Community', id: 'admin-community' },
      { href: '#admin-filters', label: 'Filters', id: 'admin-filters' },
      { href: '#admin-bulk', label: 'Bulk', id: 'admin-bulk' },
      { href: '#admin-scores', label: 'Scores', id: 'admin-scores' },
    ],
  },
]

const SECTION_IDS = GROUPS.flatMap(g => g.links.map(l => l.id))

function scrollToAdminId(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function AdminBackToNav() {
  return (
    <p className="admin-back-nav">
      <a href="#admin-nav">Back to Admin nav ↑</a>
    </p>
  )
}

export default function AdminSectionNav() {
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    const jump = () => {
      const id = resolveAdminSectionId(window.location.hash)
      if (id && document.getElementById(id)) scrollToAdminId(id)
    }
    jump()
    window.addEventListener('hashchange', jump)
    return () => window.removeEventListener('hashchange', jump)
  }, [])

  useEffect(() => {
    const nodes = SECTION_IDS.map(id => document.getElementById(id)).filter(
      (el): el is HTMLElement => !!el,
    )
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActive(visible[0].target.id)
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: [0.1, 0.25, 0.5] },
    )
    nodes.forEach(n => observer.observe(n))
    return () => observer.disconnect()
  }, [])

  return (
    <nav id="admin-nav" className="admin-section-nav" aria-label="Admin sections">
      {GROUPS.map(group => (
        <div key={group.heading} className="admin-section-nav__group">
          <span className="admin-section-nav__heading">{group.heading}</span>
          <div className="admin-section-nav__links">
            {group.links.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={active === link.id ? 'is-active' : undefined}
                onClick={e => {
                  const id = resolveAdminSectionId(link.href)
                  if (!id) return
                  e.preventDefault()
                  history.replaceState(null, '', link.href)
                  scrollToAdminId(id)
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
