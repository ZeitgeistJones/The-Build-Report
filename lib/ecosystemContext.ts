import { getRedis } from '@/lib/redis'
import { SCORING_CONTEXT_VERSION } from '@/lib/scoringContext'

const ECOSYSTEM_CONTEXT_KEY = 'build-report:ecosystem-context'

export const DEFAULT_ECOSYSTEM_CONTEXT = `
clawdbotatg is an autonomous AI builder agent on Base blockchain. It builds tools for $CLAWD token holders.
Key facts:
- leftclaw-services: AI job marketplace — users pay USDC, buys and burns CLAWD automatically
- clawd-incinerator: direct burn contract, 10M CLAWD per call
- clawd-fomo3d-v2: onchain game, 20% of every pot burned
- clawdviction / larv.ai: governance staking, locks 8% of CLAWD supply
- clawd-vesting: builder supply-lock — completed launch promise, quiet is success
- dead-simple-agent: agent framework powering the Leftclaw worker fleet
- clawd-harness: multi-session web harness for interactive Claude Code — builder shipping engine
- clawd-containers: Docker infrastructure running the worker bots
- nerve-cord: coordination layer for the builder fleet — critical shipping infra
- zkllmapi-v2: ZK-proof private AI API, accepts CLAWD as payment
- ethskills: onchain knowledge graph for agents
- yet-another-builder-agent: meta-agent that builds other agents

Tag definitions:
- direct: burn mechanic on every interaction (burns CLAWD permanently)
- supply-lock: removes CLAWD from circulation temporarily (staking/vesting)
- indirect: enables other repos that burn CLAWD — score shipping leverage, not direct burn
- infrastructure: foundational tooling — score shipping leverage, not direct CLAWD mechanic
- theoretical: R&D, no live mechanic yet

Lifecycle (display): Shipping = commits in window; Stable = quiet but functioning (normal for infra, waiting burns, locks); Done = completed supply-lock with promise held.

The project's stated goals: every consumer app burns CLAWD, autonomous operation, walkaway test (runs without clawdbotatg intervention).
`.trim()

export { SCORING_CONTEXT_VERSION }

export async function getEcosystemContext(): Promise<string | null> {
  try {
    const r = getRedis()
    const value = await r.get<string>(ECOSYSTEM_CONTEXT_KEY)
    return value?.trim() || null
  } catch {
    return null
  }
}

export async function setEcosystemContext(text: string): Promise<void> {
  const r = getRedis()
  const trimmed = text.trim()
  if (trimmed) {
    await r.set(ECOSYSTEM_CONTEXT_KEY, trimmed)
  } else {
    await r.del(ECOSYSTEM_CONTEXT_KEY)
  }
}
