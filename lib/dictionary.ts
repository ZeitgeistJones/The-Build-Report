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
    term: 'Staking / staked',
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
  {
    id: 'eth',
    term: 'ETH (Ethereum)',
    short: 'The main coin used to pay network fees on Ethereum-style chains (including Base).',
    definition:
      'Even when you’re dealing with $CLAWD on [[base]], small ETH fees often show up for [[on-chain]] actions like Rescore. Not the same token as $CLAWD.',
    group: 'crypto',
  },
  {
    id: 'defi',
    term: 'DeFi',
    short: 'Decentralized finance — money apps run by [[smart-contract]]s instead of a bank.',
    definition:
      'Lending, swaps, locks, and similar. Security writeups talk about DeFi a lot because bugs can move real funds. Related: [[tvl]], [[liquidity]], [[multisig]].',
    group: 'crypto',
  },
  {
    id: 'multisig',
    term: 'Multisig',
    short: 'A wallet that needs several people to approve before something happens.',
    definition:
      'Short for multi-signature. “3-of-5 multisig” means any 3 of 5 key-holders must agree — safer than one set of [[admin-keys]] alone for upgrades or treasury moves.',
    group: 'crypto',
  },
  {
    id: 'oracle',
    term: 'Oracle',
    short: 'A bridge that feeds real-world or off-chain facts into a [[smart-contract]].',
    definition:
      'Contracts can’t freely browse the web; an oracle supplies prices, winners, or other data. If a game needs a human/oracle to finish, that can hurt “walkaway” style scores.',
    group: 'crypto',
  },
  {
    id: 'abi',
    term: 'ABI',
    short: 'The “menu” of a contract — which functions exist and how to call them.',
    definition:
      'Application Binary Interface. Explorers and wallets use it to show human-readable contract actions. Matching [[bytecode]] to published source often goes with ABI checks.',
    group: 'crypto',
  },
  {
    id: 'bytecode',
    term: 'Bytecode',
    short: 'The compiled machine code of a [[smart-contract]] as deployed on-chain.',
    definition:
      'What the chain actually runs. Verified contracts prove this bytecode matches published source — a transparency signal.',
    group: 'crypto',
  },
  {
    id: 'immutable',
    term: 'Immutable',
    short: 'Can’t be changed after deploy — no upgrade backdoor.',
    definition:
      'For contracts: ownership burned or no upgrade path. Strong for trust (“the rules can’t quietly change”), weaker if a bug can never be patched.',
    group: 'crypto',
  },
  {
    id: 'liquidity',
    term: 'Liquidity',
    short: 'How easily a token can be bought/sold without huge price swings.',
    definition:
      'Deep liquidity = easier trading. Blurbs may mention liquidity when talking about locks, markets, or idle capital that still “works.”',
    group: 'crypto',
  },
  {
    id: 'tvl',
    term: 'TVL',
    short: 'Total Value Locked — dollars sitting in a protocol’s contracts.',
    definition:
      'A size metric for [[defi]]. Incident severity is often judged relative to TVL (“how bad was this vs what was at risk?”).',
    group: 'crypto',
  },
  {
    id: 'erc-8004',
    term: 'ERC-8004',
    short: 'A proposed standard for putting agents on-chain in a common way.',
    definition:
      'Shows up in this ecosystem’s “get agents onchain” docs. Treat it like a shared rulebook for agent identity/jobs — not a $CLAWD burn by itself.',
    group: 'crypto',
  },
  {
    id: 'testnet',
    term: 'Testnet',
    short: 'A practice blockchain where tokens aren’t real money.',
    definition:
      'Opposite of mainnet. Wrong-chain / testnet addresses in explorers are a common copy-paste gotcha when verifying [[on-chain]] claims.',
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
    id: 'security-md',
    term: 'SECURITY.md',
    short: 'A repo file explaining how to report bugs and how upgrades/security are handled.',
    definition:
      'Transparency signal next to [[readme]] and [[license]]. Blurbs notice when upgrade policy or vulnerability reporting is written down.',
    group: 'github',
  },
  {
    id: 'governance-md',
    term: 'GOVERNANCE.md',
    short: 'A doc describing who can change what — and how decisions get made.',
    definition:
      'Useful for consumer/money apps. Absence isn’t always fatal for simple tools, but “who holds the keys?” should still be answerable somehow.',
    group: 'github',
  },
  {
    id: 'gitignore',
    term: '.gitignore',
    short: 'A list of files Git should not upload (secrets, build junk, local env).',
    definition:
      'Basic hygiene: `.env` and keys should be ignored. Related to [[secrets-env]].',
    group: 'github',
  },
  {
    id: 'pull-request',
    term: 'Pull request (PR)',
    short: 'A proposed code change waiting for review before it merges.',
    definition:
      'CI often runs on every PR. “PRs welcome” docs ([[readme]] / CONTRIBUTING) are a transparency/community signal.',
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
  {
    id: 'api',
    term: 'API',
    short: 'A defined way for one program to talk to another.',
    definition:
      'Application Programming Interface. Cloud AI calls, blockchain [[rpc]]s, and app backends are all APIs. An [[api-key]] is the password-like secret that unlocks one.',
    group: 'coding',
  },
  {
    id: 'api-key',
    term: 'API key',
    short: 'A secret token that proves an app is allowed to use an [[api]].',
    definition:
      'Must stay out of the public [[repo]] (use [[secrets-env]] / [[gitignore]]). “Secrets committed to repo” is a serious red flag in security blurbs.',
    group: 'coding',
  },
  {
    id: 'dependency',
    term: 'Dependency',
    short: 'Outside code your project relies on (libraries, packages).',
    definition:
      'Tracked in package.json and pinned by a [[lockfile]]. Also used loosely for “this app depends on an [[oracle]] / human to finish” — a design dependency, not an npm package.',
    group: 'coding',
  },
  {
    id: 'npm',
    term: 'npm',
    short: 'The usual package manager / registry for JavaScript projects.',
    definition:
      '“npm audit” and Dependabot hunt known holes in dependencies. Seeing npm usually means a JS/TS app with a normal install path. See also [[dependency]].',
    group: 'coding',
  },
  {
    id: 'docker',
    term: 'Docker',
    short: 'A way to package an app and its environment so it runs the same everywhere.',
    definition:
      'Containers (and Dockerfiles) show up in supply-chain and [[ci]] discussions — pin versions, don’t trust random base images blindly. Related idea to [[vm]] isolation.',
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
    term: 'Orchestration / orchestrator',
    short: 'Software that starts, stops, and schedules workers so humans don’t babysit each one.',
    definition:
      'The orchestrator is the conductor; orchestration is the job it does — [[polling]] for work, booting [[tart]] VMs, assigning [[agent]]s. Core idea behind many [[infrastructure]] shipping scores.',
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
  {
    id: 'apple-silicon',
    term: 'Apple Silicon',
    short: 'Apple’s newer Mac chips (M1/M2/M3…) — what [[tart]] VMs run on here.',
    definition:
      'When blurbs say Apple Silicon + tart, they mean local Mac hardware hosting isolated agent [[vm]]s — not a cloud GPU farm.',
    group: 'ops',
  },
  {
    id: 'critical-path',
    term: 'Critical path',
    short: 'If this slows down or breaks, the whole shipping pipeline slows with it.',
    definition:
      'Load-bearing plumbing. Blurbs use it when a repo (often [[orchestration]] / [[agent]] hosts) is treated as essential to getting jobs done — not a side experiment.',
    group: 'ops',
  },
  {
    id: 'host-side',
    term: 'Host-side',
    short: 'Runs on a real machine (e.g. a Mac mini), not inside a blockchain contract.',
    definition:
      'Opposite of [[on-chain]]. A host-side orchestrator can still matter for burns if it feeds jobs into on-chain payment apps — it just isn’t the contract itself.',
    group: 'ops',
  },
  {
    id: 'gold-image',
    term: 'Gold image',
    short: 'A pre-baked clean machine template you clone instead of setting up from scratch.',
    definition:
      '“Baking” a gold image means installing tools once, snapshotting, then spinning new [[vm]]s from that template. Speeds [[bootstrap]] for new hosts.',
    group: 'ops',
  },
  {
    id: 'provisioning',
    term: 'Provisioning',
    short: 'Scripts that set up a machine or [[agent]] so it’s ready to work.',
    definition:
      'Files like provisionBuilderAgent.sh create accounts, env, and daemons. Related to [[bootstrap]] and [[gold-image]] baking for a whole fleet.',
    group: 'ops',
  },
  {
    id: 'polling',
    term: 'Polling / polls',
    short: 'Checking for new work on a timer (e.g. every 60 seconds).',
    definition:
      'A [[daemon]] that polls doesn’t wait for a push notification — it keeps asking “any jobs?” Common in [[orchestration]] scripts.',
    group: 'ops',
  },
  {
    id: 'boot-on-demand',
    term: 'Boot-on-demand',
    short: 'Start a [[vm]] only when there’s a job — shut it down when idle.',
    definition:
      'Saves CPU/power versus leaving agents running forever. Often paired with [[tart]] and a CLI that boots/stops VMs.',
    group: 'ops',
  },
  {
    id: 'chmod',
    term: 'chmod / chmod 600',
    short: 'A Unix permission setting — who can read or write a file.',
    definition:
      'chmod 600 means “only this user can read/write” — typical hardening for [[secrets-env]] files so other accounts on the machine can’t peek.',
    group: 'ops',
  },
  {
    id: 'keychain',
    term: 'Keychain',
    short: 'The Mac’s built-in vault for passwords and tokens.',
    definition:
      'Blurbs may say OAuth via keychain — credentials live in the OS vault instead of a plain text file. Related to [[oauth]] and [[secrets-env]].',
    group: 'ops',
  },
  {
    id: 'oauth',
    term: 'OAuth',
    short: 'A common “log in with X / grant access” standard — no raw password sharing.',
    definition:
      'Used so Claude or other APIs can authorize without stuffing long-lived secrets into the [[repo]]. Often stored in [[keychain]] on Macs.',
    group: 'ops',
  },
  {
    id: 'process-isolation',
    term: 'Process isolation (isolated / process-isolated)',
    short: 'Keeping a worker in its own box so it can’t freely touch the whole machine.',
    definition:
      '[[tart]] [[vm]]s are one form: each [[agent]] job runs separated from the host and from other jobs. “Isolated” in blurbs usually means this — not “lonely.”',
    group: 'ops',
  },
  {
    id: 'job-pickup',
    term: 'Job pickup',
    short: 'An [[agent]] claiming the next piece of work from a queue or service.',
    definition:
      'Part of the pickup → do work → completion loop. Faster reliable pickup (via [[orchestration]]) can mean more jobs finished and more downstream [[burn]]s when payments route that way.',
    group: 'ops',
  },
  {
    id: 'execution-engine',
    term: 'Execution engine',
    short: 'The layer that actually runs the jobs — not the app users click, the machinery underneath.',
    definition:
      'Blurbs use it for host-side runners ([[agent-fleet]] + [[vm]]s) that execute work at scale. Often on the [[critical-path]] for shipping.',
    group: 'ops',
  },
  {
    id: 'privilege-escalation',
    term: 'Privilege escalation',
    short: 'Finding a way to gain more power than you’re supposed to have.',
    definition:
      'Security jargon: a bug or misconfig that turns a limited [[agent]]/user into an admin. Blurbs note when root files show no obvious escalation path or loose [[admin-keys]].',
    group: 'coding',
  },
  {
    id: 'auditable',
    term: 'Auditable',
    short: 'A curious outsider can check the claims by reading the code/docs.',
    definition:
      'Versioned [[prompt]]s, clear shell scripts, and a thorough [[readme]] make a system auditable even without a formal [[security-audit]].',
    group: 'coding',
  },
  {
    id: 'runtime',
    term: 'Runtime',
    short: 'While the program is actually running — as opposed to “written in a file ahead of time.”',
    definition:
      '“Not mutable at runtime” means the [[agent]] can’t quietly rewrite its own [[prompt]]/rules while working — the instructions stay the fixed files in the [[repo]].',
    group: 'coding',
  },
  {
    id: 'mac-mini',
    term: 'Mac mini / macOS',
    short: 'Apple’s small desktop Mac — a common always-on host for local [[agent]] fleets.',
    definition:
      'Blurbs describing wipe → [[bootstrap]] → running fleet on a Mac mini mean the [[host-side]] box is a Mac, usually running [[tart]] [[vm]]s on [[apple-silicon]].',
    group: 'ops',
  },
  {
    id: 'payment-settlement',
    term: 'Payment settlement',
    short: 'The step where money is actually collected, routed, and finalized.',
    definition:
      'For CLAWD burn apps: payment in → buy/burn path completes. An orchestrator may run jobs but leave settlement to a separate [[on-chain]] service.',
    group: 'crypto',
  },
  {
    id: 'ens',
    term: 'ENS / .eth name',
    short: 'A human-readable name for a blockchain address (like pay.something.eth).',
    definition:
      'Ethereum Name Service. Easier than raw 0x… hex. Seeing pay.…eth in a blurb usually means “payments go to this named address.”',
    group: 'crypto',
  },
  {
    id: 'cli',
    term: 'CLI',
    short: 'Command-line interface — a tool you run by typing commands, not clicking a website.',
    definition:
      'Example: a cont CLI that boots/stops [[tart]] VMs. Common in [[infrastructure]] repos.',
    group: 'coding',
  },
  {
    id: 'skills',
    term: 'Skills (agent skills)',
    short: 'Reusable instruction/tool packs an [[agent]] can load for a job.',
    definition:
      'Folders like skills/ or ethskills are shared know-how agents pull in (via scripts like refresh-skills.sh). Not token burns — builder tooling.',
    group: 'ai',
  },
  {
    id: 'agent-fleet',
    term: 'Agent fleet',
    short: 'Several specialized [[agent]]s working together as a team.',
    definition:
      'E.g. auditor, builder, research, frontend-qa, feature workers — each with its own [[prompt]] and often its own [[vm]]. Managed by [[orchestration]].',
    group: 'ai',
  },
  {
    id: 'metamask',
    term: 'MetaMask',
    short: 'A popular browser [[wallet]] for Ethereum-style chains.',
    definition:
      'One way to hold tokens and sign actions. Coinbase Wallet is another. Connecting a wallet proves control of an address — it doesn’t by itself burn $CLAWD.',
    group: 'crypto',
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
