/** Curated observable signals — generic industry patterns, not project-specific prescriptions. */

export type StandardsTierExamples = {
  high: string[]
  mid: string[]
  low: string[]
}

export const BUILDER_STANDARDS_CROSS_CUTTING: string[] = [
  'Secrets committed to git history (API keys, mnemonics) — fails safety and security rows.',
  'README claims “production-ready” with no tests, changelog, or verifiable evidence.',
  'Pre-compiled binaries in source with no matching published source.',
  'No LICENSE file at repo root.',
  'Dangerous CI patterns (e.g. pull_request_target with untrusted checkout).',
]

export const BUILDER_STANDARDS_BY_ANCHOR: Record<string, StandardsTierExamples> = {
  'bi-on-chain': {
    high: [
      'Contract verified on explorer; bytecode matches published source.',
      'README documents the on-chain mechanic and matches deployed behavior.',
      'Admin/owner powers listed with plain-language scope.',
      'Infra: README states no on-chain component; no false on-chain claims.',
    ],
    mid: [
      'Contract verified but owner powers undocumented in README.',
      'Mechanic works on happy path; edge cases not documented.',
      'Infra: future on-chain mention without current architecture.',
    ],
    low: [
      'Unverified contract with fund-moving claims in README.',
      'README contradicts on-chain state (burn rate, supply cap, immutability).',
      'Infra: on-chain claims in docs with no corresponding code.',
    ],
  },
  'bi-safety': {
    high: [
      'Slippage or fund limits enforced in contract, not UI only.',
      'Documented pause criteria and authorized callers.',
      'Infra: secrets in CI store; .env.example with placeholders only.',
    ],
    mid: [
      'UI-only slippage warnings bypassable via direct contract calls.',
      'Infra: basic .gitignore for .env; no secret scanning in CI.',
    ],
    low: [
      'No fail-safes on money-moving paths.',
      'Admin withdrawal with no timelock or documentation.',
      'Infra: credentials committed in git history.',
    ],
  },
  'bi-transparency': {
    high: [
      'CHANGELOG or Releases for every tagged version.',
      'SECURITY.md with contact and disclosure timeline.',
      'Known limitations documented and consistent with behavior.',
      'Infra: README defines what the tool does and does not do.',
    ],
    mid: [
      'Changelog inconsistent across releases.',
      'Claims in README without reproducible evidence.',
      'Infra: accurate but sparse README.',
    ],
    low: [
      'No changelog; version history only in commit messages.',
      'README architecture contradicts code across releases.',
      'Infra: documented features not implemented without “roadmap” label.',
    ],
  },
  'bi-governance': {
    high: [
      'GOVERNANCE.md or CONTRIBUTING.md with decision process.',
      'Economic claims verifiable from on-chain data or committed docs.',
      'Infra: honest maintainer role; contribution path documented.',
    ],
    mid: [
      'Informal governance in issues only.',
      'Infra: single maintainer without written process but clear from history.',
    ],
    low: [
      'Misleading “decentralized” label with single admin key.',
      'Economic claims contradict on-chain state.',
      'Infra: unverifiable ecosystem impact claims.',
    ],
  },
  'bi-security': {
    high: [
      'CI runs tests on every PR; dependencies pinned in workflows.',
      'Dependabot/Renovate with reviewed updates.',
      'Infra: tests + CI; SECURITY.md with contact.',
    ],
    mid: [
      'Tests present; coverage not tracked; SAST not in CI.',
      'Infra: sparse tests but CI runs on push.',
    ],
    low: [
      'No automated tests; no CI on PRs.',
      'Known critical CVEs unaddressed for extended period.',
      'Infra: dangerous workflow patterns unaddressed.',
    ],
  },
}
