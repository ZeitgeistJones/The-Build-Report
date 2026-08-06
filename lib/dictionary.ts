/**
 * Standalone holder Dictionary — general crypto / GitHub / coding / AI terms
 * that show up in score explanations. Not the Start Here glossary (site UI terms).
 * Overlap with the glossary is fine when a word appears in both places.
 */

export type DictionaryGroupId = 'crypto' | 'github' | 'coding' | 'ai' | 'ops'

export type DictionaryEntry = {
  id: string
  term: string
  /** One-line peek for tooltips. */
  short: string
  /**
   * Fuller layman definition. Mark related terms with [[term-id]] —
   * rendered as tooltip + “See here” jump on the Dictionary page.
   */
  definition: string
  group: DictionaryGroupId
}

export const DICTIONARY_GROUPS: { id: DictionaryGroupId; label: string; blurb: string }[] = [
  {
    id: 'crypto',
    label: 'Crypto & on-chain',
    blurb: 'Tokens, burns, contracts, wallets — money and blockchain words in the blurbs.',
  },
  {
    id: 'github',
    label: 'GitHub & repos',
    blurb: 'How code is stored, shared, and updated on GitHub.',
  },
  {
    id: 'coding',
    label: 'Coding & software',
    blurb: 'Everyday engineering words that show up when scores talk about quality.',
  },
  {
    id: 'ai',
    label: 'AI & agents',
    blurb: 'Models, agents, local AI stacks — without assuming you build them.',
  },
  {
    id: 'ops',
    label: 'Ops & infrastructure',
    blurb: 'Servers, VMs, secrets, orchestration — the “keeps it running” layer.',
  },
]

export const DICTIONARY_ENTRIES: DictionaryEntry[] = [
  // —— Crypto ——
  {
    id: 'burn',
    term: 'Burn',
    short: 'Permanently destroying tokens so total supply goes down.',
    definition:
      'Tokens are sent somewhere nobody can recover them. Supply shrinks. Different from a [[supply-lock]] (parked, not destroyed). On this site, “burn” usually means $CLAWD unless the blurb says otherwise (e.g. CV).',
    group: 'crypto',
  },
  {
    id: 'supply-lock',
    term: 'Supply-lock',
    short: 'Parking tokens so they can’t trade — locked up, not destroyed.',
    definition:
      'Tokens leave the free-floating supply without being burned. Sibling idea to a [[burn]]. Quiet “job finished” status can be success for a lock, not abandonment.',
    group: 'crypto',
  },
  {
    id: 'on-chain',
    term: 'On-chain',
    short: 'Happening on the blockchain in public code anyone can check.',
    definition:
      'Opposite of “only on someone’s laptop.” [[smart-contract]]s, many [[burn]]s, and payment settlement are on-chain. A Mac mini running agents can be off-chain but still important.',
    group: 'crypto',
  },
  {
    id: 'smart-contract',
    term: 'Smart contract',
    short: 'A program on the blockchain that runs the rules automatically.',
    definition:
      'Once deployed, it enforces its own logic (payments, burns, locks) without trusting a human to “do the right thing” each time. Part of what “[[on-chain]] commitments” means.',
    group: 'crypto',
  },
  {
    id: 'wallet',
    term: 'Wallet',
    short: 'An app that holds your tokens and signs actions — like a digital ID + pocket.',
    definition:
      'MetaMask, Coinbase Wallet, etc. Connecting a wallet proves you control an address. Fees for [[on-chain]] actions are usually paid in ETH even when the token is $CLAWD on Base.',
    group: 'crypto',
  },
  {
    id: 'base',
    term: 'Base',
    short: 'The blockchain network $CLAWD lives on.',
    definition:
      'A network built to run Ethereum-style [[smart-contract]]s with lower fees. When blurbs say “on Base,” they mean this chain — not “basic” or “baseline.”',
    group: 'crypto',
  },
  {
    id: 'rpc',
    term: 'RPC',
    short: 'How apps ask a blockchain node “what’s on chain?” or “send this transaction.”',
    definition:
      'Remote Procedure Call — a technical pipe to read or write [[on-chain]] data. Rate limits and public RPCs show up when infra talks about scanning logs or confirming burns.',
    group: 'crypto',
  },
  {
    id: 'staking',
    term: 'Staking',
    short: 'Locking tokens to earn rights or rewards — not the same as burning them.',
    definition:
      'You keep ownership (usually) but can’t freely sell while staked. On this site, CV (conviction) is earned by staking $CLAWD — different from a [[burn]].',
    group: 'crypto',
  },
  {
    id: 'token-economics',
    term: 'Token economics (tokenomics)',
    short: 'How a token’s supply, burns, locks, and incentives are supposed to work.',
    definition:
      'The “money design” around a token. Score blurbs use it when asking whether a repo aligns with $CLAWD’s economy or is agnostic plumbing.',
    group: 'crypto',
  },
  {
    id: 'admin-keys',
    term: 'Admin keys / privilege',
    short: 'Special powers that let someone change or pause the system.',
    definition:
      'Useful in emergencies, risky if hidden or unlimited. Blurbs care whether admin powers exist, who holds them, and whether that matches the safety story.',
    group: 'crypto',
  },

  // —— GitHub ——
  {
    id: 'repo',
    term: 'Repo (repository)',
    short: 'One project’s code folder on GitHub.',
    definition:
      'Holds the files, history, and docs for an app or tool. Each card on The Build Report is one repo (unless noted otherwise).',
    group: 'github',
  },
  {
    id: 'commit',
    term: 'Commit',
    short: 'One saved change to the code — like hitting save with a note.',
    definition:
      'Each commit has a time and message. “Recent commits” on the site means the project is still being edited and pushed.',
    group: 'github',
  },
  {
    id: 'push',
    term: 'Push',
    short: 'Uploading your commits to GitHub so others can see them.',
    definition:
      '“Last pushed” is when the latest [[commit]]s hit the remote [[repo]]. Local work that never gets pushed doesn’t show up here.',
    group: 'github',
  },
  {
    id: 'readme',
    term: 'README',
    short: 'The front-page doc in a repo explaining what it is and how it works.',
    definition:
      'Scores lean on the README a lot — if claims aren’t written down, the scorer can’t credit them. Often paired with root file names as evidence.',
    group: 'github',
  },
  {
    id: 'root-files',
    term: 'Root files',
    short: 'The top-level files and folders you see when you open a repo.',
    definition:
      'package.json, README, scripts/, .github/, etc. The scorer looks at this listing (plus README text) as evidence — not every deep file.',
    group: 'github',
  },
  {
    id: 'license',
    term: 'LICENSE',
    short: 'A file that says how others may use the code.',
    definition:
      'Missing LICENSE doesn’t always kill a score, but blurbs may note it under transparency — “can people legally reuse this?”',
    group: 'github',
  },
  {
    id: 'changelog',
    term: 'CHANGELOG',
    short: 'A running list of what changed between versions.',
    definition:
      'Helps humans see progress over time. Absence is often noted next to missing [[ci]] or tests when judging polish.',
    group: 'github',
  },
  {
    id: 'org',
    term: 'Org (organization)',
    short: 'A shared GitHub account that owns many repos.',
    definition:
      'Here, the tracked org is typically clawdbotatg — many repos under one umbrella.',
    group: 'github',
  },

  // —— Coding ——
  {
    id: 'ci',
    term: 'CI / CI/CD',
    short: 'Automatic checks that run when code changes — tests, builds, deploys.',
    definition:
      'Continuous Integration (and sometimes Deployment). “CI=no” in a blurb means those automated pipelines weren’t found — not always fatal for simple tools, but it matters for money-touching code.',
    group: 'coding',
  },
  {
    id: 'tests',
    term: 'Tests / test suite',
    short: 'Extra programs that check the main program still behaves.',
    definition:
      'Automated safety net. Blurbs say “tests=no” when none are evident. For low-risk host scripts, isolation can matter more; for wallets and contracts, tests matter a lot.',
    group: 'coding',
  },
  {
    id: 'lockfile',
    term: 'Lockfile',
    short: 'A file that pins exact dependency versions so installs match.',
    definition:
      'package-lock.json, yarn.lock, pnpm-lock.yaml, etc. Evidence the project is a real installable app, not just a sketch.',
    group: 'coding',
  },
  {
    id: 'stdlib',
    term: 'Stdlib (standard library)',
    short: 'Built-in language tools — not third-party packages.',
    definition:
      'Shows up when blurbs talk about whether a project reinvented basics or used normal language features. Pure jargon; safe to ignore unless comparing code quality.',
    group: 'coding',
  },
  {
    id: 'open-source',
    term: 'Open source',
    short: 'Source code is public so anyone can read (and often reuse) it.',
    definition:
      'Transparency scores love this. “Open” still needs a clear [[readme]] and honest scope — public code you can’t understand doesn’t help holders much.',
    group: 'coding',
  },
  {
    id: 'security-audit',
    term: 'Security audit',
    short: 'An outside (or formal) review hunting for ways the system can be abused.',
    definition:
      'Strong signal for high-risk money code. Missing an audit isn’t automatic failure for a simple local tool, but blurbs will say so under security rigor.',
    group: 'coding',
  },
  {
    id: 'versioning',
    term: 'Versioning',
    short: 'Labeling releases (v1.2.3) so people know what changed.',
    definition:
      'Tags, releases, and [[changelog]]s. Helps verifiability — “which build are we talking about?”',
    group: 'coding',
  },

  // —— AI ——
  {
    id: 'agent',
    term: 'Agent (AI agent)',
    short: 'An AI worker given a job and tools — less “chat,” more “go do this.”',
    definition:
      'In this ecosystem: specialized workers (builder, auditor, research, etc.) that pick up jobs and act. Different from a plain chatbot. Often run inside [[vm]]s or containers and orchestrated by scripts.',
    group: 'ai',
  },
  {
    id: 'llm',
    term: 'LLM',
    short: 'Large Language Model — the text AI behind ChatGPT-style tools.',
    definition:
      'The model that reads prompts and writes answers or code. Local stacks may run an [[llm]] via [[ollama]]; cloud stacks call an API.',
    group: 'ai',
  },
  {
    id: 'ollama',
    term: 'Ollama',
    short: 'Software that runs AI models on your own computer.',
    definition:
      'Keeps the [[llm]] local instead of sending everything to a cloud API. Shows up in privacy-focused apps (notes, voice) next to tools like [[whisper]].',
    group: 'ai',
  },
  {
    id: 'whisper',
    term: 'whisper.cpp / Whisper',
    short: 'Speech-to-text: turns audio into written words, often locally.',
    definition:
      '“whisper.cpp” is a fast local implementation. When blurbs mention it with [[ollama]], they usually mean “this app processes voice on your machine, not in the cloud.”',
    group: 'ai',
  },
  {
    id: 'prompt',
    term: 'Prompt (agent prompt)',
    short: 'Written instructions that steer what an AI agent is allowed to do.',
    definition:
      'Versioned prompt files (e.g. builder.prompt.md) make agent behavior reviewable. Fixed prompts reduce “the AI can rewrite its own rules at runtime” risk.',
    group: 'ai',
  },
  {
    id: 'mcp',
    term: 'MCP',
    short: 'A way for AI tools to plug into apps and data sources with a shared protocol.',
    definition:
      'Model Context Protocol. Seeing an mcp folder or server often means “this is built so agents/tools can connect,” not that it burns tokens by itself.',
    group: 'ai',
  },
  {
    id: 'claude-code',
    term: 'Claude Code',
    short: 'Anthropic’s coding agent product — AI that works in a software project.',
    definition:
      'Blurbs may mention Claude Code workers as the [[agent]]s doing auditor/builder/QA jobs inside [[vm]]s.',
    group: 'ai',
  },

  // —— Ops ——
  {
    id: 'vm',
    term: 'VM (virtual machine)',
    short: 'A simulated computer inside your real computer — isolated from the host.',
    definition:
      'Used so an [[agent]] can work without freely touching everything on the Mac. “Ephemeral VMs” means they get wiped between jobs — less leftover mess or drift.',
    group: 'ops',
  },
  {
    id: 'tart',
    term: 'tart (VMs)',
    short: 'A tool for running macOS virtual machines on Apple Silicon.',
    definition:
      'When blurbs say tart VMs, they mean isolated Mac-like environments for agents — related to [[vm]] isolation and boot-on-demand orchestration.',
    group: 'ops',
  },
  {
    id: 'orchestration',
    term: 'Orchestration',
    short: 'Software that starts, stops, and schedules workers so humans don’t babysit each one.',
    definition:
      'Scripts like agent-wrangler.sh polling for jobs, booting [[tart]] VMs, assigning [[agent]]s. Core idea behind many [[infrastructure]] shipping scores.',
    group: 'ops',
  },
  {
    id: 'infrastructure',
    term: 'Infrastructure (infra)',
    short: 'Behind-the-scenes tools that help other apps ship — not the consumer app itself.',
    definition:
      'Orchestrators, agent hosts, shared skill packs, etc. Scored more on leverage and safety-of-ops than on “did this button burn $CLAWD?”',
    group: 'ops',
  },
  {
    id: 'secrets-env',
    term: '.env / secrets',
    short: 'Local files holding passwords and API keys — should not be committed to GitHub.',
    definition:
      'Blurbs praise gitignored .env files and tight file permissions (e.g. chmod 600). Keys in the [[repo]] are a red flag.',
    group: 'ops',
  },
  {
    id: 'daemon',
    term: 'Daemon',
    short: 'A background program that keeps running and doing its job.',
    definition:
      'A polling daemon checks for new work on a timer (e.g. every 60s). Single-daemon designs can be a clear control point — or a single point of failure.',
    group: 'ops',
  },
  {
    id: 'bootstrap',
    term: 'Bootstrap / provision',
    short: 'Setup steps to go from empty machine → working system.',
    definition:
      'install.sh, provision.sh, “gold image” baking — docs and scripts that make a new host reproducible. Signals maintained [[infrastructure]].',
    group: 'ops',
  },
  {
    id: 'ephemeral',
    term: 'Ephemeral',
    short: 'Temporary — reset or thrown away after use.',
    definition:
      'Ephemeral [[vm]]s reset per job so agent state doesn’t pile up. A safety posture word: less persistence, less surprise leftover access.',
    group: 'ops',
  },
]

const byId = new Map(DICTIONARY_ENTRIES.map(e => [e.id, e]))

export function getDictionaryEntry(id: string): DictionaryEntry | undefined {
  return byId.get(id)
}

export function dictionaryEntriesInGroup(group: DictionaryGroupId): DictionaryEntry[] {
  return DICTIONARY_ENTRIES.filter(e => e.group === group)
}

/** Split definition text into plain runs and [[term-id]] refs. */
export function parseDictionaryDefinition(
  definition: string,
): Array<{ type: 'text'; value: string } | { type: 'ref'; id: string }> {
  const parts: Array<{ type: 'text'; value: string } | { type: 'ref'; id: string }> = []
  const re = /\[\[([a-z0-9-]+)\]\]/gi
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(definition))) {
    if (m.index > last) {
      parts.push({ type: 'text', value: definition.slice(last, m.index) })
    }
    parts.push({ type: 'ref', id: m[1]! })
    last = m.index + m[0].length
  }
  if (last < definition.length) {
    parts.push({ type: 'text', value: definition.slice(last) })
  }
  return parts
}
