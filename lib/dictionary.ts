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
      'A team/company account on GitHub — many [[repo]]s under one umbrella, shared permissions and billing.',
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
    term: 'Lockfile (package-lock.json / yarn.lock)',
    short: 'A file that pins exact dependency versions so installs match.',
    definition:
      'package-lock.json, yarn.lock, pnpm-lock.yaml, etc. Evidence the project is a real installable app, not just a sketch. Goes with [[package-json]].',
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
  {
    id: 'typescript',
    term: 'TypeScript',
    short: 'JavaScript with types — catches many mistakes before the app runs.',
    definition:
      'Common for web and agent tooling. Seeing TypeScript (or tsconfig.json) usually means a typed JS codebase, often with a [[package-json]] / [[lockfile]] install path.',
    group: 'coding',
  },
  {
    id: 'javascript',
    term: 'JavaScript',
    short: 'The main language of the web and of many Node agents/tools.',
    definition:
      'Runs in browsers and on servers via [[nodejs]]. Blurbs mention it when describing what a [[repo]] is built with.',
    group: 'coding',
  },
  {
    id: 'nodejs',
    term: 'Node.js',
    short: 'A way to run [[javascript]] on a server or your computer — not only in a browser.',
    definition:
      '“Node 20+” means the runtime version. Most JS agent CLIs and web backends here assume Node is installed.',
    group: 'coding',
  },
  {
    id: 'package-json',
    term: 'package.json',
    short: 'The manifest listing a JS/TS project’s name, scripts, and dependencies.',
    definition:
      'Paired with a [[lockfile]] (package-lock.json or yarn.lock) so installs are repeatable. Strong “this is a real app” evidence in root files. See also [[dependency]].',
    group: 'coding',
  },
  {
    id: 'nextjs',
    term: 'Next.js',
    short: 'A popular React framework for building websites and web apps.',
    definition:
      'Shows up when a [[repo]] is a web UI or full-stack app. Not a burn mechanic by itself — just the web stack.',
    group: 'coding',
  },
  {
    id: 'websocket',
    term: 'WebSocket',
    short: 'A live two-way link between an app and a server (streams, not one-off requests).',
    definition:
      'Used for realtime video, chat, or feeds. Different from a normal [[api]] request that asks once and hangs up.',
    group: 'coding',
  },
  {
    id: 'sdk',
    term: 'SDK',
    short: 'Software Development Kit — a packaged set of tools/libraries builders use to integrate a service.',
    definition:
      'An Agent SDK or wallet SDK is someone else’s toolkit your [[repo]] imports. Useful leverage; also a [[dependency]] you have to trust and update.',
    group: 'coding',
  },
  {
    id: 'rust',
    term: 'Rust',
    short: 'A systems programming language used for fast, memory-safe tools and some crypto stacks.',
    definition:
      'Cargo, rust-toolchain, and GPU setup scripts are clues. Different from [[typescript]]/[[javascript]] web apps.',
    group: 'coding',
  },
  {
    id: 'cron',
    term: 'Cron',
    short: 'A scheduler that runs a job on a timer (every minute, hour, day…).',
    definition:
      'Blurbs mention cron when bots or servers do recurring work — similar idea to [[polling]], but usually “fire this script on a schedule.”',
    group: 'ops',
  },
  {
    id: 'gas',
    term: 'Gas',
    short: 'The fee paid to the network to run an [[on-chain]] action.',
    definition:
      'Paid in the chain’s native coin (often [[eth]]). “Gas sponsorship” means someone else covers that fee so users can act without holding ETH.',
    group: 'crypto',
  },
  {
    id: 'usdc',
    term: 'USDC',
    short: 'A common dollar-pegged stablecoin used for payments.',
    definition:
      'Blurbs like “buy-and-burn on USDC payments” mean users pay in USDC, then the app buys and [[burn]]s the project token.',
    group: 'crypto',
  },
  {
    id: 'calldata',
    term: 'Calldata',
    short: 'The data payload sent with a blockchain transaction — “what to do” on a [[smart-contract]].',
    definition:
      'Encoding calldata correctly is how wallets and agents call contracts. A “calldata translation layer” turns human intent into those bytes.',
    group: 'crypto',
  },
  {
    id: 'layerzero',
    term: 'LayerZero',
    short: 'A protocol for messages/tokens moving across different blockchains.',
    definition:
      '“LayerZero endpoint” in a blurb means cross-chain plumbing is involved — bridging or messaging, not a simple single-chain [[burn]].',
    group: 'crypto',
  },
  {
    id: 'eip-712',
    term: 'EIP-712 / meta-transaction',
    short: 'A signed message pattern so someone else can submit your [[on-chain]] action and often pay [[gas]].',
    definition:
      'Common in “gasless” flows: you sign off-chain; a relayer posts the transaction. Related to sponsored gas, not the same as a [[burn]].',
    group: 'crypto',
  },
  {
    id: 'foundry',
    term: 'Foundry',
    short: 'A popular toolkit for building and testing [[smart-contract]]s (Forge, Cast, Anvil).',
    definition:
      'foundry.toml / foundry.lock in root usually means Solidity work with serious local testing — stronger than “contracts exist but untested.”',
    group: 'crypto',
  },
  {
    id: 'webauthn',
    term: 'WebAuthn / passkey',
    short: 'Sign in or approve actions with a device key (fingerprint, Face ID, security key) instead of a seed phrase alone.',
    definition:
      'Often paired with smart accounts. Stronger phishing resistance than a raw private key in a file — still an auth/signing topic, not a [[burn]].',
    group: 'crypto',
  },
  {
    id: 'zero-knowledge',
    term: 'Zero-knowledge (ZK)',
    short: 'Cryptography that proves something is true without revealing the secret details.',
    definition:
      'Used in privacy and scaling systems. A “ZK circuit” is the math program being proved. Related craft: [[r1cs]], [[lean-4]], formal proofs — not the same as a token [[burn]].',
    group: 'crypto',
  },
  {
    id: 'r1cs',
    term: 'R1CS',
    short: 'A common format for writing the constraints inside a [[zero-knowledge]] circuit.',
    definition:
      'Rank-1 Constraint System. When blurbs mention isR1CS / circuit shapes, they mean the proof system’s puzzle pieces — deep crypto engineering jargon.',
    group: 'crypto',
  },
  {
    id: 'lean-4',
    term: 'Lean 4',
    short: 'A language/tool for writing machine-checked mathematical proofs.',
    definition:
      '“Formal verification”: the computer rejects invalid proofs. Used in competitive ZK / circuit work. Related: lake build, axioms, soundness/completeness.',
    group: 'crypto',
  },
  {
    id: 'formal-verification',
    term: 'Formal verification',
    short: 'Proving software or math claims with machine-checked logic — stronger than normal [[tests]].',
    definition:
      'Common in high-assurance crypto ([[lean-4]], circuit proofs). The typechecker/verifier is the test harness.',
    group: 'crypto',
  },
  {
    id: 'solidity',
    term: 'Solidity',
    short: 'The main language for writing Ethereum-style [[smart-contract]]s.',
    definition:
      '`.sol` files, [[foundry]], and NatSpec comments are Solidity clues. Deployed Solidity becomes [[bytecode]] on chain.',
    group: 'crypto',
  },
  {
    id: 'uniswap',
    term: 'Uniswap / DEX',
    short: 'A decentralized exchange — smart contracts that swap tokens without a company order book.',
    definition:
      'Uniswap V3 is a common DEX on [[base]]. Blurbs about USDC → [[weth]] → token routes usually mean automated market buys (often into a [[burn]] path).',
    group: 'crypto',
  },
  {
    id: 'weth',
    term: 'WETH',
    short: 'Wrapped ETH — ETH in [[erc-20]] token form so it can go through token routers.',
    definition:
      'Many DEX routes hop through WETH (e.g. USDC → WETH → CLAWD). It’s still ETH economically; the wrap is plumbing.',
    group: 'crypto',
  },
  {
    id: 'erc-20',
    term: 'ERC-20',
    short: 'The standard interface for fungible tokens on Ethereum-style chains.',
    definition:
      'Almost every “token” balance/transfer you see follows ERC-20. Swaps, burns, and locks usually move ERC-20 balances.',
    group: 'crypto',
  },
  {
    id: 'x402',
    term: 'x402',
    short: 'A payment protocol pattern for paying for API/agent work over HTTP-ish flows.',
    definition:
      'Shows up when job marketplaces auto-collect USDC/CLAWD for work. Think “pay-to-call” plumbing, often paired with a DEX swap into the project token.',
    group: 'crypto',
  },
  {
    id: 'natspec',
    term: 'NatSpec',
    short: 'Structured documentation comments inside [[solidity]] contracts.',
    definition:
      'Helps humans and tools understand what a function is supposed to do. A transparency signal on contract repos.',
    group: 'crypto',
  },
  {
    id: 'playwright',
    term: 'Playwright',
    short: 'A toolkit for driving a real browser automatically (clicks, navigation, checks).',
    definition:
      'Often paired with [[devtools-protocol]] / headless Chrome for agent workflows. Powerful automation — treat credentials and profiles carefully.',
    group: 'coding',
  },
  {
    id: 'headless',
    term: 'Headless (browser)',
    short: 'Running Chrome/Firefox without a visible window — automation-only.',
    definition:
      'Common with [[playwright]]. Same browser engine, no GUI. Good for servers; still a full browser attack surface.',
    group: 'coding',
  },
  {
    id: 'openapi',
    term: 'OpenAPI',
    short: 'A standard way to describe an HTTP [[api]] so tools can document and call it.',
    definition:
      'Schemas/specs that list endpoints and payloads. Helps discoverability (and scanners) without reading all the code.',
    group: 'coding',
  },
  {
    id: 'webhook',
    term: 'Webhook',
    short: 'Your server gets a ping when something happens elsewhere (job done, payment cleared).',
    definition:
      'Push notifications between services. Opposite of pure [[polling]] — the other system calls you.',
    group: 'coding',
  },
  {
    id: 'pty',
    term: 'PTY',
    short: 'Pseudo-terminal — the byte stream a terminal app uses (like a fake keyboard/screen pipe).',
    definition:
      'Harnesses that mirror PTY bytes into [[xterm]] UIs are showing a live shell session in the browser. Low-level terminal plumbing.',
    group: 'ops',
  },
  {
    id: 'xterm',
    term: 'xterm.js',
    short: 'A terminal emulator that runs in a web page.',
    definition:
      'Renders the green-text shell UI in-browser. Often fed by [[pty]] mirroring from a local server.',
    group: 'ops',
  },
  {
    id: 'sse',
    term: 'SSE (Server-Sent Events)',
    short: 'A one-way live stream from server → browser (prices, logs, progress).',
    definition:
      'Lighter than a full [[websocket]] when you only need server push. Streams should be closed cleanly when done.',
    group: 'coding',
  },
  {
    id: 'tts',
    term: 'TTS (text-to-speech)',
    short: 'Software that turns written text into spoken audio.',
    definition:
      'Used in voice/avatar agents. Often a third-party API cost — not automatically a token [[burn]] unless the product wires payment that way.',
    group: 'ai',
  },
  {
    id: 'wake-word',
    term: 'Wake word',
    short: 'The phrase that “wakes” a listening mic (like “Hey Siri”).',
    definition:
      'Local voice UIs use wake-word detection before heavier speech-to-text ([[whisper]]) / [[llm]] work. Privacy-sensitive: mic access.',
    group: 'ai',
  },
  {
    id: 'obs',
    term: 'OBS / browser source',
    short: 'OBS Studio streaming software; a browser source is a live webpage fed into the stream.',
    definition:
      'Agents that “appear on Zoom” often render a UI OBS captures as a virtual camera. Media plumbing, not on-chain economics.',
    group: 'ops',
  },
  {
    id: 'launchd',
    term: 'launchd',
    short: 'macOS’s built-in service manager — keeps background jobs running / restarting.',
    definition:
      'Similar job to systemd on Linux. Blurbs about OAuth keepalive under launchd mean the Mac is supervising the [[daemon]].',
    group: 'ops',
  },
  {
    id: 'gitleaks',
    term: 'gitleaks',
    short: 'A scanner that hunts accidentally committed secrets in git history.',
    definition:
      'Often wired into [[ci]] or [[husky]] hooks. Complements [[gitignore]] / [[secrets-env]] hygiene.',
    group: 'coding',
  },
  {
    id: 'husky',
    term: 'Husky / lint-staged',
    short: 'Git hooks that run checks (lint, secret scan) before you commit or push.',
    definition:
      'Automation that keeps bad commits out. A polish signal on JS/TS repos next to [[ci]].',
    group: 'coding',
  },
  {
    id: 'ocr',
    term: 'OCR',
    short: 'Optical Character Recognition — reading text out of images/screenshots.',
    definition:
      'Vision pipelines (Apple Vision, etc.) turn pixels into words. Useful in local note apps alongside [[whisper]].',
    group: 'ai',
  },
  {
    id: 'sherpa-onnx',
    term: 'sherpa-onnx',
    short: 'Local speech toolkit (often speaker ID / ASR) that can run without the cloud.',
    definition:
      'Shows up with [[whisper]] / [[ollama]] in privacy-first audio apps. On-device ML, not a chain mechanic.',
    group: 'ai',
  },
  {
    id: 'huggingface',
    term: 'Hugging Face',
    short: 'A big public hub for AI models and datasets.',
    definition:
      'Blurbs naming a model “on Hugging Face” mean weights are downloadable/linkable — reproducibility signal for [[inference]].',
    group: 'ai',
  },
  {
    id: 'localstorage',
    term: 'localStorage',
    short: 'Browser storage that saves small data on the user’s device.',
    definition:
      'Convenient and not a vault — anything in localStorage can be read by scripts on that site. Not for private keys.',
    group: 'coding',
  },

  {
    id: 'inference',
    term: 'Inference',
    short: 'Running a trained AI model to get an answer or action — “using” the model, not training it.',
    definition:
      'Local inference means the [[llm]] runs on your machine (e.g. via [[ollama]] or [[llama-cpp]]). Cloud inference calls an API instead.',
    group: 'ai',
  },
  {
    id: 'llama-cpp',
    term: 'llama.cpp',
    short: 'Popular open-source software for running LLMs efficiently on your own hardware.',
    definition:
      'Often paired with Metal/GPU acceleration on Macs. Related local-stack cousin to [[ollama]] and [[whisper]].',
    group: 'ai',
  },
  {
    id: 'screencapturekit',
    term: 'ScreenCaptureKit',
    short: 'Apple’s framework for capturing screen/audio on macOS.',
    definition:
      'Shows up in local note/meeting apps next to [[whisper]] / [[ollama]] — “this records or sees the screen on your Mac,” not a cloud bot.',
    group: 'ai',
  },
  {
    id: 'devtools-protocol',
    term: 'Chrome DevTools Protocol',
    short: 'A remote-control API for a real Chrome browser tab (click, navigate, inspect).',
    definition:
      'Agents use it to drive a real browser instead of a fake one. Powerful and sensitive — closer to “hands on a computer” than a pure text [[llm]].',
    group: 'ai',
  },
  {
    id: 'contributing-md',
    term: 'CONTRIBUTING.md',
    short: 'A guide for how outsiders should propose changes (PRs, style, tests).',
    definition:
      'Transparency signal next to [[readme]] and [[pull-request]] norms. Missing isn’t fatal for solo tools; nice for open collaboration.',
    group: 'github',
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
      'Folders like skills/ hold reusable instruction or tool packs an [[agent]] can load for a job. Builder tooling — not a token mechanic.',
    group: 'ai',
  },
  {
    id: 'agent-fleet',
    term: 'Agent fleet',
    short: 'Several specialized [[agent]]s working together as a team.',
    definition:
      'E.g. auditor, builder, research, QA workers — each with its own [[prompt]] and often its own [[vm]]. Managed by [[orchestration]].',
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
  {
    id: 'ad-hoc',
    term: 'Ad-hoc',
    short: 'One-off / as-needed — not a standing product or shipping system.',
    definition:
      'In score blurbs (e.g. clawd-research), “ad-hoc” means scratch-pad or lab-notebook work: useful exploration, but not production code other builders depend on every day. That framing usually keeps shipping-leverage scores low.',
    group: 'coding',
  },
  {
    id: 'mainnet',
    term: 'Mainnet',
    short: 'The real blockchain with real money — not a practice network.',
    definition:
      'Opposite of a [[testnet]]. When blurbs say a page “reads from mainnet,” they mean live chain data, not a sandbox.',
    group: 'crypto',
  },
  {
    id: 'ipfs',
    term: 'IPFS',
    short: 'A way to store files by content, not by a single company’s server.',
    definition:
      'Used a lot for podcast video, clip galleries, and “pin this file.” A [[cid]] is the fingerprint of the file. Different from a normal website host like Vercel.',
    group: 'crypto',
  },
  {
    id: 'cid',
    term: 'CID',
    short: 'Content ID — the fingerprint of a file on [[ipfs]].',
    definition:
      'If the bytes change, the CID changes. Blurbs mention updating a manifest CID when new clips get pinned.',
    group: 'crypto',
  },
  {
    id: 'contenthash',
    term: 'Contenthash',
    short: 'An [[ens]] record that points a name at website content (often via [[ipfs]]).',
    definition:
      'Lets something.eth resolve to a site without only depending on one company’s servers. Common with Scaffold-ETH / three-surface deploys.',
    group: 'crypto',
  },
  {
    id: 'vesting',
    term: 'Vesting',
    short: 'Unlocking tokens over time instead of all at once.',
    definition:
      'A linear vest streams the same amount each day/second until the schedule finishes. Related to [[supply-lock]]: tokens may be parked until they unlock.',
    group: 'crypto',
  },
  {
    id: 'slash',
    term: 'Slash',
    short: 'A penalty that takes away staked or locked tokens for bad behavior.',
    definition:
      'Governance or contracts can “slash” someone (often with a public reason). Different from a voluntary [[burn]].',
    group: 'crypto',
  },
  {
    id: 'scaffold-eth',
    term: 'Scaffold-ETH',
    short: 'A popular starter kit for Ethereum apps (often called SE2).',
    definition:
      'Gives builders a ready [[wallet]] UI, [[smart-contract]] hooks, and deploy patterns. Score blurbs mention it when a front end is built on that stack.',
    group: 'coding',
  },
  {
    id: 'tui',
    term: 'TUI',
    short: 'Text UI — an interactive terminal interface, not a web page.',
    definition:
      'Blurbs contrast interactive TUI sessions with [[headless]] / scripted runs (different billing and behavior). Related to [[pty]] when a harness mirrors a terminal.',
    group: 'coding',
  },
  {
    id: 'ffmpeg',
    term: 'FFmpeg',
    short: 'The common open-source tool for cutting and converting video/audio.',
    definition:
      'Shows up in clip pipelines: take a long episode, cut short shareable moments, write .mp4 files.',
    group: 'coding',
  },
  {
    id: 'smoke-test',
    term: 'Smoke test',
    short: 'A quick “does it basically run?” check — not a full test suite.',
    definition:
      'Better than nothing, weaker than automated [[tests]] / [[ci]]. Blurbs mention smoke scripts when formal coverage is missing.',
    group: 'coding',
  },
  {
    id: 'noir',
    term: 'Noir',
    short: 'A language for writing zero-knowledge proofs.',
    definition:
      'Research and contest repos may explore Noir the way others explore [[lean-4]] or [[r1cs]] — math proofs a computer can check, not a consumer burn app by itself.',
    group: 'crypto',
  },
  {
    id: 'prompt-injection',
    term: 'Prompt injection',
    short: 'Tricking an AI by hiding instructions inside the text it reads.',
    definition:
      'Like SQL injection, but for [[llm]]s / [[agent]]s. Security blurbs care when tools handle untrusted input or secrets.',
    group: 'ai',
  },
  {
    id: 'persona',
    term: 'Persona',
    short: 'The character / role file that steers how an [[agent]] behaves.',
    definition:
      'Often a markdown “brain” (goals, tone, tools). Sandboxes spin up many personas to test agents before real jobs.',
    group: 'ai',
  },
  {
    id: 'encryption-at-rest',
    term: 'Encryption at rest',
    short: 'Scrambling files on disk so stolen drives aren’t readable.',
    definition:
      'Different from encrypting data in transit (HTTPS). Blurbs ding repos that keep [[secrets-env]] plaintext on disk with no encryption-at-rest story.',
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
