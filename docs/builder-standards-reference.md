# Builder Standards Rubric: "How We Score" Reference Guide

## Why "Standards" Framing, Not "Integrity" Language

Grading repos on **observable, verifiable standards** rather than moral language like "integrity" or "honesty" keeps scoring defensible, repeatable, and resistant to gaming. When rubric rows describe what reviewers can *check* — a file exists, a CI job runs, a lock is on-chain — scores carry the same meaning across reviewers and across time. Standards framing also separates signal from intent: a repo can fail a standard without anyone being dishonest, and a repo can pass all standards without anyone being virtuous. This distinction matters when scores are commit-weighted: contributors respond to observable checkboxes, not exhortations. Using behavioral, standards-based descriptors also aligns with established educational and professional rubric design principles, which hold that criteria must be "observable and measurable" and use "parallel language across the scale".[^1][^2][^3]

***

## Cross-Cutting Signals (Apply to Multiple Rows)

These patterns affect several rubric rows simultaneously. A single finding here can drag multiple scores down.

- **Secrets committed to repo** — Any API key, private key, mnemonic, or credential in git history (even in a deleted commit) is a simultaneous failure in Row 2 (user risk) and Row 5 (security). Tools like `git log -S "sk-"`, `truffleHog`, or GitGuardian can surface these in a public repo.[^4][^5]
- **README scope inflation** — Claims like "enterprise-grade" or "production-ready" with no tests, no changelog, and no audit trail simultaneously affect Row 3 (transparency) and Row 4 (ecosystem alignment). Reviewers can cross-check claims against CI status and commit history.[^6][^7]
- **Binary artifacts committed to source** — Pre-compiled binaries in the repo cannot be reviewed or traced to source, degrading Row 3 (verifiability) and Row 5 (security) simultaneously. The OpenSSF Scorecard flags this as a high-risk indicator.[^8][^9]
- **No license file** — Absence of a LICENSE file at the repo root blocks downstream security audits and community contribution, impacting Row 3 (transparency) and Row 4 (governance). OpenSSF Scorecard awards 0/10 on this check when absent.[^10][^8]
- **Dangerous CI workflow patterns** — Using `pull_request_target` with an explicit PR checkout grants write access to the repo, enabling injection of malicious code. This is a Critical-rated risk affecting Row 4 (governance) and Row 5 (security).[^11][^8]

***

## Row 1: On-Chain Commitments and Constraints (22%)

This row assesses whether the repo's on-chain posture — or explicit *absence* of on-chain code — is accurately represented and appropriately constrained.

### Consumer Repos

Consumer repos with smart contracts should demonstrate that upgrade authority is limited, time-constrained, and observable on-chain.

**High:**
- Contract source code verified and publicly readable on a block explorer (e.g., matching bytecode to published source)[^12][^13]
- Upgrade authority held by a multi-party multisig (3-of-5 or similar), not a single externally owned account (EOA); verifiable in contract storage[^14][^12]
- Timelock delay documented and enforced on-chain for any upgrade action (e.g., 48-hour minimum delay visible in contract logic)[^15][^12]
- Upgrade policy stated in `README` or `SECURITY.md` with exact delay and quorum requirements; claim is independently verifiable against deployed contract[^13][^14]
- Immutable or non-upgradeable flag explicit in contract code or documented in README with deployment address for verification[^16][^17]
- SLSA provenance attestation published with release artifacts, linking build inputs to deployed bytecode[^18][^19]
- Bug bounty scope explicitly includes contract upgrade path and admin key compromise scenarios[^20][^13]

**Mid:**
- Contract is verified on-chain but upgrade key is held by a single address; README acknowledges this without timeline to improve[^14][^13]
- Timelock documented but shorter than community norms (e.g., 12-hour delay instead of 48+) with no stated roadmap to extend[^12]
- Upgrade policy described in README but not linked to the deployed address or checked against actual contract code[^14]
- External audit completed but upgrade/admin path was out of scope; README notes this gap[^21][^20]

**Low:**
- Contract not verified on any block explorer; no way for a third party to inspect deployed logic[^16][^13]
- README claims "immutable" or "non-upgradeable" but deployed contract contains an `upgradeTo` function with no timelock[^22][^12]
- Upgrade key held by a single EOA with no multisig, no timelock, and no public acknowledgment of this risk[^13][^14]
- On-chain behavior contradicts documented behavior; discrepancy not addressed in recent releases or issues[^12]

### Infrastructure / Dev-Tool Repos

Infrastructure repos (libraries, CI tools, containers, test harnesses) should not have on-chain code at all. Scoring is about appropriate absence and honest scoping.

**High:**
- README explicitly states the tool has no on-chain component and handles no user funds; scope boundary is unambiguous[^7][^6]
- If the tool integrates with external APIs or signing infrastructure, session/credential scope is documented (e.g., read-only keys, scoped tokens with least privilege)[^5][^4]
- No on-chain claims anywhere in docs, marketing copy, or README that cannot be independently verified[^7]
- If the tool generates code that *will be* deployed (e.g., contract scaffolding), generated output is clearly labeled "example only" and not production-ready[^6]

**Mid:**
- Repo is genuinely infrastructure but README mentions a future on-chain component without timeline or current architecture[^7]
- API tokens referenced in `.env.example` with placeholder values and notes to users; no `.env` committed, but no automated secret scanning in CI[^23][^5]
- Tool generates or touches signing logic but documentation does not explain the trust boundaries[^4]

**Low:**
- Repo claims on-chain functionality in docs or marketing but contains none; or claims "trustless" behavior when all logic is centralized off-chain[^22]
- Hard-coded API keys, RPC endpoints with embedded credentials, or signing keys committed in source history[^5][^4]
- README copy-pasted from a different (consumer) project; on-chain claims inherited that do not apply to this tool[^7]

### Common Mistakes Reviewers Make

- **Penalizing infra repos for "no on-chain commits"** — An infra repo with appropriate absence of on-chain code should default to the *High* band, not be punished for lacking smart contracts.
- **Taking README claims at face value** — Always cross-check upgrade claims against the deployed contract address; discrepancies between documentation and deployed bytecode are a Low signal regardless of how polished the docs are.[^12]
- **Conflating audit presence with constraint adequacy** — A repo can have an audit and still hold upgrade keys in a single EOA. The constraint (timelock, multisig) is what scores, not the audit alone.[^13][^14]

***

## Row 2: User Funds, Risk, and Safety Posture (20%)

This row evaluates how well the repo protects users from unexpected fund loss or exposure, proportionate to whether funds actually flow through the code.

### Consumer Repos

**High:**
- On-chain slippage protection enforced at the contract level, not only in the UI; any transaction exceeding a threshold reverts automatically[^24][^13]
- Emergency pause mechanism with publicly documented trigger criteria, authorized callers, and unpause conditions committed to repo or linked in README[^25][^13]
- Maximum per-transaction or per-block limits on fund movement are enforced in code and documented[^21][^13]
- Circuit breaker logic present: protocol auto-pauses if a price oracle deviates beyond a defined threshold[^26][^13]
- User-facing warnings for high-impact operations (e.g., slippage > 10%) enforced in the interface, with a required confirmation step[^24]
- Bug bounty active with scope including fund-drain scenarios and commensurate payout relative to protocol TVL[^20][^21]
- Incident response runbook committed to repo, including communication templates and emergency multisig steps[^25][^13]

**Mid:**
- Slippage protection exists in the UI layer only (not contract-enforced); users can bypass it via direct contract calls[^24][^13]
- Pause mechanism exists but authorized callers not documented; no defined unpause criteria in README[^25]
- Bug bounty exists but scope excludes the upgrade path or oracle manipulation vectors[^20]
- README acknowledges fund risks in general terms without specific mitigations or architecture references[^13]

**Low:**
- No slippage protection at any layer; user can receive near-zero value for a large swap with no warning[^24]
- No pause or circuit breaker capability; no incident response plan committed to repo[^25][^13]
- Hard-coded admin withdrawal function with no timelock, no multisig, and no documentation[^14][^13]
- README describes fund safety features (e.g., "non-custodial") that are contradicted by contract logic allowing admin withdrawal[^22]

### Infrastructure / Dev-Tool Repos

Infra repos default to **Mid** when no user funds flow. Scoring deviates upward or downward based on credential and session hygiene.

**High (deviation above mid):**
- `.env.example` template committed with all required keys stubbed out; README explains how to provision credentials for local dev vs. CI[^23][^5]
- CI secrets managed via platform secret store (e.g., GitHub Actions encrypted secrets), not hardcoded in workflow YAML[^27][^23]
- Least-privilege token scopes documented: read-only tokens for read operations, scoped write tokens never committed[^4][^5]
- If the tool generates or handles signing keys, a dedicated secrets management section in README explains safe usage patterns[^4]

**Mid (default):**
- No user funds handled; credential management is basic but acceptable (`.gitignore` covers `.env`, no known leaks in history)[^23][^5]
- No automated secret scanning in CI, but no evidence of committed secrets[^4]

**Low (deviation below mid — requires active negligence):**
- API keys, RPC credentials, or private keys committed anywhere in git history, including deleted files[^5][^4]
- CI workflow logs print environment variables containing secrets (e.g., `echo $API_KEY` in a run step)[^4]
- README instructs users to paste credentials directly into source files rather than using environment variables[^5]

### Common Mistakes Reviewers Make

- **Marking infra repos Low by default** — Default is Mid for infra repos where no funds flow. Low requires evidence of active credential exposure or negligence.[^4]
- **Crediting UI-layer slippage as High** — Contract-level enforcement is required for High; UI-only warnings can be bypassed and are a Mid signal at best.[^24]
- **Conflating "non-custodial" marketing with actual safety posture** — Check contract functions, not README claims. Admin withdrawal functions without timelocks are a Low signal regardless of labeling.[^22][^13]

***

## Row 3: Transparency and Verifiability (18%)

This row evaluates whether a reviewer can independently verify what the repo claims to do, track changes over time, and understand its honest limitations.

### Consumer Repos

**High:**
- Complete, machine-readable changelog (`CHANGELOG.md` or GitHub Releases) with entries for every tagged release, including breaking changes and security fixes[^9][^8]
- All performance, benchmark, or security claims in README linked to reproducible evidence (e.g., a test script that generates the benchmark, or an audit report PDF in the repo)[^6][^7]
- README includes an explicit "Known Limitations" or "Out of Scope" section; documented limitations are consistent with observed behavior[^6][^7]
- Reproducible builds documented: a reviewer can check out the tagged commit and produce an artifact matching the published hash[^19][^28]
- SBOM (Software Bill of Materials) published as a release artifact in a standard format (SPDX or CycloneDX)[^8]
- SECURITY.md present at repo root with a contact method, disclosure timeline (e.g., "30 days"), and scope statement[^29][^8]
- Signed releases with verifiable signatures (`.asc`, `.sigstore`, or SLSA provenance) attached to every GitHub release[^28][^8]

**Mid:**
- Changelog exists but is inconsistently maintained; some releases have entries, others do not[^9][^8]
- Performance claims present in README but not linked to reproducible evidence; a reviewer must trust the claim without checking[^6]
- SECURITY.md present but contains only a generic contact email with no disclosure timeline or scope[^29][^8]
- Source is public but build process is undocumented; an outside reviewer cannot reproduce published artifacts[^19]
- Known limitations exist but are buried in issues or PRs rather than surfaced in README or docs[^6]

**Low:**
- No changelog; version history must be reconstructed from commit messages[^8][^9]
- Benchmark or security claims (e.g., "audited", "99.9% uptime") with no supporting evidence in repo or linked docs[^7][^6]
- README describes a different architecture than the actual code; discrepancy persists across multiple release cycles[^7]
- No SECURITY.md and no alternative disclosure mechanism; vulnerabilities can only be reported via public GitHub Issues[^29][^8]
- Commits rewritten or force-pushed to public branches, destroying verifiable history[^11][^8]

### Infrastructure / Dev-Tool Repos

**High:**
- README clearly defines what the tool does *and* what it does not do; both boundaries are observable in code[^6][^7]
- Integration examples are runnable as-is (no `TODO: fill in your credentials` blocks left in committed examples)[^6]
- CHANGELOG covers every tagged version; entries specify API-breaking changes prominently[^9][^8]
- All third-party dependencies are declared in a lockfile committed to the repo, enabling deterministic installs[^30][^8]

**Mid:**
- README is accurate but sparse; limitations must be inferred from code rather than documentation[^6]
- Examples work with placeholder substitution clearly marked; not runnable without user setup[^6]
- Dependencies declared but no lockfile; installs are not reproducible across environments[^30]

**Low:**
- README or docs describe features not yet implemented and marked neither "roadmap" nor "experimental"[^7]
- Examples fail to run with the documented setup; no indication of known breakage[^6]
- Changelog absent; users cannot determine what changed between versions without reading diffs[^9]

### Common Mistakes Reviewers Make

- **Marking a repo High because source is public** — Public code is necessary but not sufficient. Verifiability requires a documented build process, reproducible artifacts, and a changelog.[^19][^6]
- **Penalizing honest "Known Limitations" sections** — Documenting limitations *improves* the transparency score; their absence is the concern.[^7][^6]
- **Counting an audit PDF link as a transparency signal without checking the link resolves** — A broken or paywalled link to an audit is a Mid-to-Low signal, not High.[^20][^7]

***

## Row 4: Governance, Token-Economics, and Ecosystem Alignment (20%)

This row assesses whether the repo honestly represents its role in a larger ecosystem, avoids misleading economic claims, and has a documented decision-making structure.

### Consumer Repos

**High:**
- `GOVERNANCE.md` (or equivalent) present at repo root; documents decision-making process, roles, voting mechanism, and how changes to governance itself are proposed[^31][^32][^33]
- Tokenomics or incentive design documented with explicit assumptions; emission schedules, vesting cliffs, and supply mechanics are verifiable against on-chain state[^20][^13]
- Repo accurately describes its position in a dependency chain (e.g., "this UI depends on Protocol X smart contracts; governance of those contracts is separate")[^34][^7]
- Upgrade proposals go through a documented, time-limited public comment period before implementation[^32][^34][^14]
- No economic claims that cannot be independently verified from public on-chain data or committed docs[^22][^13]
- Code of Conduct referenced and enforced; publicly documented moderation process[^33][^32]

**Mid:**
- Decision-making process is described informally in README or issue threads rather than a dedicated governance document[^35][^34]
- Tokenomics documented but with gaps (e.g., vesting schedule documented, total supply not verifiable without trusting team)[^20]
- Repo accurately describes its own scope but does not document dependencies or upstream governance[^34][^7]
- One active maintainer with no documented succession plan or contributor pathway[^36][^2]

**Low:**
- No governance documentation; decisions are made without visible process, documentation, or appeal mechanism[^31][^35][^36]
- Economic claims in README that contradict or are unverifiable against on-chain state (e.g., "deflationary" when supply is uncapped)[^13][^22]
- Repo presents itself as "decentralized" while all contract admin keys and upgrade authority are held by a single address[^22]
- Governance process described but demonstrably not followed (e.g., "all changes require a 3-day comment period" contradicted by merged PRs with same-day approval)[^36][^34]

### Infrastructure / Dev-Tool Repos

Infra repos should be **credited for enabling shipping**, not penalized for lacking holder UIs, voting tokens, or burn mechanisms they have no reason to implement.

**High:**
- README clearly situates the tool in the ecosystem: what it enables, who maintains it, and what upstream/downstream dependencies exist[^34][^6]
- Contribution guide (`CONTRIBUTING.md`) documents how PRs are reviewed, merged, and released; roles and responsibilities are explicit[^32][^36][^34]
- No claims of ecosystem impact that cannot be independently verified (e.g., "used by 10,000 developers" backed by a link to download stats)[^7][^6]
- Governance documentation appropriate to project scale: a solo-maintained utility tool can say "decisions made by @maintainer; major changes discussed in Issues"; this is honest and sufficient[^35][^36]

**Mid:**
- CONTRIBUTING.md absent; contribution process described only in README or not at all[^32][^36]
- Maintainer identity and decision authority implicit; clear from commit history but not formally documented[^36]
- Tool described as "community-maintained" with a single active contributor; aspiration noted but not achieved[^2]

**Low:**
- No documented decision-making process of any kind; PRs merged with no review policy, no documented rationale, and no way for a contributor to predict acceptance[^35][^36]
- Ecosystem claims that cannot be verified: e.g., "trusted by leading protocols" with no evidence in repo[^22][^7]
- Repo abandoned without notice; no archived or deprecated marker, yet issues receive no response[^2][^6]

### Common Mistakes Reviewers Make

- **Penalizing infra repos for lacking tokenomics** — A library or CI tool has no reason to document token economics. Absence of token mechanics is not a governance failure for infra repos.[^2]
- **Treating governance document presence as governance adequacy** — Check whether documented processes are actually followed (e.g., review merge timestamps against stated comment periods).[^34][^36]
- **Confusing contributor count with governance quality** — A well-governed solo-maintained tool outscores a poorly governed multi-contributor repo. Document the process, whatever the headcount.[^35][^36]

***

## Row 5: Security, Testing, and Cryptographic Rigor (20%)

This row evaluates the repo's testing discipline, dependency hygiene, and use of cryptographic mechanisms proportionate to the risk level.

### Consumer Repos

**High:**
- Automated test suite with documented coverage; CI runs on every pull request and coverage is tracked (e.g., coverage badge or report artifact in CI)[^10][^8][^9]
- SAST (Static Application Security Testing) integrated in CI pipeline (e.g., CodeQL, Semgrep) with findings addressed before merge[^8][^9]
- All GitHub Actions and Dockerfile dependencies pinned to a full commit SHA or digest hash, not a mutable tag (e.g., `actions/checkout@v4` replaced with the SHA)[^11][^8]
- Automated dependency update tool configured (Dependabot or Renovate) with open PRs reviewed regularly; no known critical CVEs outstanding in declared dependencies[^37][^30][^8]
- Branch protection enforces at least one required reviewer before merge; force pushes to main/release branches disabled[^11][^8]
- SECURITY.md with private vulnerability reporting path (e.g., GitHub private security advisory) rather than public Issues[^29][^8]
- For cryptographic operations: uses well-audited libraries (e.g., `libsodium`, `nacl`); custom cryptographic primitives absent or, if present, separately audited[^38][^39]
- Signed releases with SLSA provenance or equivalent for each published version[^18][^28]

**Mid:**
- Tests exist but coverage is untracked or inconsistent; CI runs but does not enforce a coverage threshold[^9][^6]
- Dependencies tracked in a lockfile but not pinned to hash in CI workflows; Dependabot configured but PRs accumulate without review[^30][^8]
- Branch protection enabled but without required reviewers (force push prevention only)[^8][^11]
- SAST not integrated in CI; security scanning run manually or never[^8][^9]
- Cryptographic operations use well-known libraries but with default or uncustomized parameters not reviewed against current recommendations[^38]

**Low:**
- No automated tests; or tests exist but CI does not run them on PRs[^9][^8]
- Secrets committed in source history (current or deleted commits)[^5][^4]
- Mutable tags or `latest` used for all CI dependencies; supply chain attack surface unmitigated[^11][^8]
- Known critical or high CVEs outstanding in declared dependencies with no fix or documented mitigation[^30][^8]
- Custom cryptographic implementation for a sensitive operation (e.g., key derivation, signature verification) with no external audit[^39][^38]
- `pull_request_target` workflow trigger combined with explicit PR checkout — OpenSSF Scorecard rates this Critical[^8][^9]

### Infrastructure / Dev-Tool Repos

Infra repos should default to **Mid for reasonable dev practice**. Low requires evidence of negligence, not just imperfection.

**High:**
- Unit and integration tests present; CI runs on every PR; README explains how to run the test suite locally[^8][^6]
- All CI dependencies (GitHub Actions, Docker images) pinned by digest; Dependabot or Renovate configured[^11][^8]
- Cryptographic operations, if any (e.g., token signing, hash verification), use standard library functions from audited packages; no hand-rolled implementations[^39][^38]
- SAST or linting with security rules integrated in CI[^9][^8]
- SECURITY.md present with at minimum a contact method for vulnerability reports[^29][^8]

**Mid (default for reasonable dev practice):**
- Tests present but sparse; CI runs on push but not on PRs consistently[^8][^6]
- Dependencies declared with semantic version ranges, not pinned to digest; no automated update bot, but no known outstanding CVEs[^30][^8]
- No SAST in CI; basic linting present[^9][^8]
- Token permissions for GitHub Actions workflows set at `contents: read` by default but not explicitly declared in YAML[^11][^8]

**Low (requires active negligence):**
- No tests of any kind; no CI pipeline; changes merged with no automated validation[^9][^8]
- Secrets or credentials present in repo history[^5][^4]
- Dangerous CI workflow patterns (e.g., `pull_request_target` with PR checkout) present and unaddressed[^8][^9]
- Known critical CVEs in dependencies unaddressed for 90+ days with no documented mitigation[^30][^8]

### Common Mistakes Reviewers Make

- **Marking infra repos Low simply for lacking tests on non-critical utility code** — Low requires *no tests and no CI at all*, not imperfect coverage. A well-maintained utility with 60% coverage and a passing CI pipeline is Mid, not Low.[^8][^6]
- **Crediting test presence without checking CI integration** — A `tests/` directory with no CI hook is documentation, not assurance. The CI run on pull requests is what matters.[^10][^8]
- **Treating "uses a library" as cryptographic rigor** — Verify the library is well-maintained and the usage pattern is correct (e.g., proper IV/nonce generation). Misuse of a sound library is still a security failure.[^38][^39]
- **Ignoring token permission scope** — GitHub Actions workflows with `permissions: write-all` or unscoped `GITHUB_TOKEN` are a Mid-to-Low signal even if other practices are sound.[^11][^8]

***

## Reference Frameworks

The following established frameworks informed this rubric and provide additional depth for reviewers who want to trace specific checks to authoritative sources:

| Framework | What It Covers | Relevant Rows |
|---|---|---|
| **OpenSSF Scorecard** | Automated checks for branch protection, code review, dependency pinning, SAST, signed releases, token permissions, dangerous workflows[^1][^9] | Rows 3, 5 |
| **SLSA (Supply-chain Levels for Software Artifacts)** | Provenance attestation, reproducible builds, hermetic build environments, two-person review[^18][^19][^28] | Rows 1, 3, 5 |
| **OWASP ASVS / Secure Coding Practices** | Input validation, authentication, session management, cryptographic standards, secure defaults[^40][^38][^39] | Rows 2, 5 |
| **OpenSSF Concise Guide for Evaluating OSS** | Maintenance, security response, interface stability, secure defaults, vulnerability reporting[^7] | Rows 3, 4, 5 |
| **CNCF / OpenSSF Governance Templates** | GOVERNANCE.md structure, maintainer roles, decision-making, elections, steering committees[^32][^33][^34] | Row 4 |
| **GitGuardian API Security Best Practices** | Secret hygiene, `.gitignore` discipline, temporary credentials, least-privilege key scoping[^5][^4] | Rows 2, 5 |
| **OpenSSF Best Practices Badge** | Passing/Silver/Gold tiers covering documentation, testing, security policy, and change control[^1][^8] | All rows |

---

## References

1. [Reducing Security Risks in Open Source Software at Scale](https://openssf.org/blog/2022/01/19/reducing-security-risks-in-open-source-software-at-scale-scorecards-launches-v4/)

2. [GitHub - apereo/oss-rubric: A rubric to rate the maturity of open source software projects](https://github.com/apereo/oss-rubric) - A rubric to rate the maturity of open source software projects - apereo/oss-rubric

3. [Criteria](https://otl.du.edu/wp-content/uploads/2014/11/Rubric-rubric.pdf)

4. [API Key Management Best Practices for Secure Secrets Storage](https://blog.gitguardian.com/secrets-api-management/) - Core best practices include avoiding unencrypted secrets in Git repositories, enforcing automated se...

5. [APISecurityBestPractices/Good development practices.md at master · GitGuardian/APISecurityBestPractices](https://github.com/GitGuardian/APISecurityBestPractices/blob/master/Good%20development%20practices.md) - Resources to help you keep secrets (API keys, database credentials, certificates, ...) out of source...

6. [Appendix: ML OSS Evaluation Rubric¶](https://derwen.ai/docs/txg/rubric/) - Explore uses of large language models (LLMs) in semi-automated knowledge graph (KG) construction fro...

7. [wg-best-practices-os-developers/docs/Concise-Guide-for-Evaluating-Open-Source-Software.md at main · ossf/wg-best-practices-os-developers](https://github.com/ossf/wg-best-practices-os-developers/blob/main/docs/Concise-Guide-for-Evaluating-Open-Source-Software.md)

8. [scorecard/docs/checks.md at main · ossf/scorecard](https://github.com/ossf/scorecard/blob/main/docs/checks.md) - OpenSSF Scorecard - Security health metrics for Open Source - ossf/scorecard

9. [OpenSSF Scorecard - A tool for automatically assessing the security ...](https://www.x-cmd.com/blog/240711/) - daily news - July 11, 2024, OpenSSF Scorecard - A tool for automatically assessing the security risk...

10. [Project Lifecycle Transitions based on OpenSSF Scorecard](https://lf-hyperledger.atlassian.net/wiki/spaces/TF/pages/21011885)

11. [OpenSSF scorecard report](https://securityscorecards.dev/viewer/?platform=github.com&org=dubzzz&repo=fast-check) - OpenSSF scorecard report

12. [SCWE-005: Insecure Upgradeable Proxy Design](https://scs.owasp.org/SCWE/SCSVS-ARCH/SCWE-005/) - Access Control: Ensure only trusted parties (e.g., contract owners, multisig wallets) can perform up...

13. [DeFi Security Best Practices](https://node.security/docs/best-practices/defi-security/) - A comprehensive guide to DeFi security best practices, covering economic security design, protocol-s...

14. [Upgradeable Smart Contracts: Proxies, Patterns, Pitfalls and CI/CD ...](https://www.octane.security/post/upgradeable-smart-contracts-proxies-patterns-pitfalls-cicd-safeguards) - Use a multisig or decentralized autonomous organization (DAO) as the upgrade admin, never a single E...

15. [Upgrading smart contracts | ethereum.org](https://ethereum.org/developers/docs/smart-contracts/upgrading/) - Proxy patterns adopt a catch-all approach to access controls. An entity with access to upgrade funct...

16. [Upgradeable smart contract security: proxy risks and best practices](https://www.smartcontractaudit.com/guides/upgradeable-smart-contract-security) - Upgradeable contracts use proxy patterns that carry storage-collision, initializer, and upgrade-key ...

17. [3) Beacon Proxy Pattern](https://www.blockchain-council.org/solidity/upgradable-smart-contracts-solidity-proxy-patterns-storage-layout-best-practices/) - Understand proxy patterns, EIP-1967 storage layout, initializer vs constructor rules, and governance...

18. [SLSA v1.1](https://slsa.dev/spec/v1.1/) - SLSA is a specification for describing and incrementally improving supply chain security, establishe...

19. [Supply Chain Levels for Software Artifacts (SLSA)](https://www.activestate.com/resources/quick-reads/supply-chain-levels-for-software-artifacts-slsa/) - Learn what the SLSA security framework is and how you can use it.

20. [DeFi Safety Playbook: Staking Best Practices, Yield Farming Risk ...](https://cryptorbix.com/en/b/defi-safety-playbook-staking-best-practices-yield-farming-risk-controls-audit-checklists) - Practical 2026 DeFi safety playbook: staking best practices, yield-farming risk controls, and a mode...

21. [DeFi Security Playbook: Smart Contract Audits, MEV Protection, and ...](https://cryptorbix.com/en/b/defi-security-playbook-smart-contract-audits-mev-protection-yield-farming) - Bitcoin outlook 2026: how institutional ETFs, macro drivers, and advanced trading strategies shape v...

22. [How 'Decentralization Theater' in DeFi Is Making Your Funds Less ...](https://www.youtube.com/watch?v=GLMhWPGHiDA) - ... protect their users when an attack happens? Ether.Fi CEO Mike Silagadze calls it “decentralizati...

23. [Best practice for API keys in public repos? #169652](https://github.com/orgs/community/discussions/169652) - Hi everyone, What's the standard way to handle secrets like API keys in a public portfolio project? ...

24. [DeFi Security Incident Highlights Industry Challenges](https://www.linkedin.com/posts/philippzentner_yesterday-was-a-difficult-moment-for-defi-activity-7438227572225662976-6p0d) - Yesterday was a difficult moment for DeFi. A user attempted to buy a token with roughly $50M USDT th...

25. [What is an Emergency Pause? | DeFi Safety Mechanisms - Fensory](https://fensory.com/insights/glossary/emergency-pause) - Understand emergency pause mechanisms - how protocols halt operations during security incidents.

26. [DeFi Risk Controls: Why Protocols Need Circuit Breakers ...](https://www.mexc.com/news/1116710) - DeFi protocols face new pressure to add circuit breakers, pause logic and safer liquidation controls...

27. [git - Should I use gitignore or "your-api-key-here" to hide api key on ...](https://stackoverflow.com/questions/65482531/should-i-use-gitignore-or-your-api-key-here-to-hide-api-key-on-github) - Ideally, your API key should never be in the codebase to begin with. A common option is to take the ...

28. [Understanding SLSA For Supply Chain Security - CD Office Hours](https://octopus.com/blog/understanding-slsa-for-supply-chain-security) - Learn how SLSA have became a very popular set of guidelines and a pathway to making software secure.

29. [Security & Responsible Disclosure¶](https://openmed.life/docs/security/disclosure-policy/) - Open-source healthcare NLP toolkit with curated models, Apple Silicon MLX acceleration, OpenMedKit f...

30. [Supply Chain Attacks](https://www.jamesrossjr.com/blog/dependency-vulnerability-management) - Manage dependency vulnerabilities effectively — npm audit, Dependabot, Software Bill of Materials, t...

31. [Governance.md Guide - Master Open Source Project Governance](https://governance.md) - Learn how to create effective governance.md files for your open source projects. Complete guide cove...

32. [project-template/GOVERNANCE.md at main · cncf/project-template](https://github.com/cncf/project-template/blob/main/GOVERNANCE.md) - CNCF Project Template. Contribute to cncf/project-template development by creating an account on Git...

33. [governance/ORG-GOVERNANCE.md at main · fairlearn/governance](https://github.com/fairlearn/governance/blob/main/ORG-GOVERNANCE.md) - Governance documents for the Fairlearn Organization. - fairlearn/governance

34. [semaphore/GOVERNANCE.md at main · semaphoreio/semaphore](https://github.com/semaphoreio/semaphore/blob/main/GOVERNANCE.md) - Semaphore is an open source CI/CD platform. Self-host Semaphore on your own servers or on a cloud pr...

35. [Add a governance.md file to all your OSS projects](https://modeling-languages.com/add-a-governance-md-file-to-all-your-oss-projects/) - Who decides what feature requests / bug notifications to accept (and how? when?). OSS should clearly...

36. [Leadership and Governance | Open Source Guides](https://opensource.guide/leadership-and-governance/) - Understanding governance for your growing project · What are examples of formal roles used in open s...

37. [Dependency Security Guide | Vulnerability Scanning Best Practices](https://scopeforged.com/blog/dependency-security-scanning-and-management) - Secure your software supply chain. Learn vulnerability scanning tools, automated security updates, a...

38. [Introduction](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/01-introduction/05-introduction) - Secure Coding Practices on the main website for The OWASP Foundation. OWASP is a nonprofit foundatio...

39. [OWASP Secure Coding Quick Reference Guide](https://www.slideshare.net/slideshow/owasp-50022553/50022553?nway-content_model=D) - This document provides a checklist of secure coding practices for software developers. It covers top...

40. [ASVS/4.0/en/0x10-V1-Architecture.md at master · OWASP/ASVS](https://github.com/OWASP/ASVS/blob/master/4.0/en/0x10-V1-Architecture.md) - Application Security Verification Standard. Contribute to OWASP/ASVS development by creating an acco...

