import { getAdminNotes } from '@/lib/admin'
import { getCachedAutoScoresResult } from '@/lib/autoscore'
import { getGitHubStatsForDisplay } from '@/lib/githubStatsSnapshot'
import { REPOS } from '@/lib/scores'

export type OverheardRepoContext = {
  slug: string
  name: string
  tag: string | null
  status: string | null
  summary: string
  adminNote: string | null
}

function adminNoteForSlug(notes: Record<string, string>, slug: string): string | null {
  const handScored = REPOS.find(r => r.githubSlug === slug)
  if (handScored?.id && notes[handScored.id]) return notes[handScored.id]
  if (notes[slug]) return notes[slug]
  return null
}

/** Repo card / admin-note context for Overheard writeup prompts. */
export async function getOverheardRepoContext(repoSlug: string): Promise<OverheardRepoContext> {
  const slug = repoSlug.trim()
  const handScored = REPOS.find(r => r.githubSlug === slug)
  const notes = await getAdminNotes().catch(() => ({}))

  if (handScored) {
    return {
      slug,
      name: handScored.name,
      tag: handScored.tag,
      status: handScored.status,
      summary: handScored.verdict?.trim() || 'No summary available.',
      adminNote: adminNoteForSlug(notes, slug),
    }
  }

  const cached = await getCachedAutoScoresResult([slug]).catch(() => ({ repos: [], cacheReadFailed: true }))
  const auto = cached.repos.find(r => r.githubSlug === slug)
  if (auto) {
    return {
      slug,
      name: auto.name,
      tag: auto.tag,
      status: auto.status,
      summary: auto.verdict?.trim() || 'Auto-inferred repo — no verdict cached.',
      adminNote: adminNoteForSlug(notes, slug),
    }
  }

  const stats = await getGitHubStatsForDisplay().catch(() => null)
  const gh = stats?.trackableRepos?.find(r => r.name === slug)
  return {
    slug,
    name: slug,
    tag: null,
    status: null,
    summary: gh?.description?.trim() || 'Trackable clawdbotatg repo — no scored summary yet.',
    adminNote: adminNoteForSlug(notes, slug),
  }
}

export function formatRepoContextBlock(ctx: OverheardRepoContext): string {
  const lines = [
    `Repo: ${ctx.name} (${ctx.slug})`,
    ctx.tag ? `Tag: ${ctx.tag}` : null,
    ctx.status ? `Status: ${ctx.status}` : null,
    `Summary: ${ctx.summary}`,
    ctx.adminNote ? `Admin context note: ${ctx.adminNote}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}
