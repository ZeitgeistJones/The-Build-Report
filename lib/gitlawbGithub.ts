/**
 * Back-compat wrappers — prefer lib/externalOwnerGithub.ts for new accounts.
 */

import {
  fetchExternalOwnerDayActivity,
  type ExternalDayActivity,
  type ExternalDaySnapshot,
  type ExternalRepoCommit,
} from '@/lib/externalOwnerGithub'
import { yesterdayMountainDateKey } from '@/lib/buildBrief'

export type GitlawbRepoCommit = ExternalRepoCommit
export type GitlawbDayActivity = ExternalDayActivity
export type GitlawbDaySnapshot = ExternalDaySnapshot

export const GITLAWB_OWNER = 'gitlawb'

export async function fetchGitlawbDayActivity(
  mountainDateKey = yesterdayMountainDateKey(),
): Promise<GitlawbDaySnapshot> {
  return fetchExternalOwnerDayActivity(GITLAWB_OWNER, mountainDateKey)
}
