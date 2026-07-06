# Row 1: On-Chain Commitments — Small Consumer Apps (Supplement)

**Scope:** OSS apps with one verified contract doing a simple job — accepting payments,
burning a fee on use, locking supply at deploy, tipping, minting a receipt NFT, etc.
Protocol-grade controls (multisig, timelock, DAO vote) are **not** required here and
should **not** be used as High criteria for this tier.

---

## High

- Contract source verified on a public block explorer; a reviewer can confirm the
  deployed bytecode matches the published Solidity without trusting the team.
  *(Ref: QuickNode — https://www.quicknode.com/guides/ethereum-development/smart-contracts/different-ways-to-verify-smart-contract-code)*

- README documents the single on-chain mechanic clearly (e.g., "2% of each payment is
  burned; see `burn()` in contract line 47") and that claim is verifiable by reading the
  deployed contract.
  *(Ref: ethereum.org — https://ethereum.org/ru/developers/tutorials/smart-contract-security-guidelines/)*

- All admin or owner functions listed in README with a plain-language description of what
  each can do (e.g., "owner can pause tip acceptance; cannot withdraw user balances").
  *(Ref: ethereum.org security guidelines; ScienceDirect SCSVS — https://www.sciencedirect.com/science/article/pii/S2096720925000946)*

- If the contract is intentionally non-upgradeable, that is stated in README **and** the
  deployed contract has no `upgradeTo`, `setImplementation`, or equivalent function —
  both sides of the claim are checkable.
  *(Ref: arXiv smart contract upgrades — https://arxiv.org/html/2504.09652v1; Kaia Docs — https://docs.kaia.io/build/best-practices/smart-contract-security-best-practices/)*

- If a pause or owner-withdrawal function exists, README explicitly names it, explains
  when it would be used, and does **not** describe the contract as "fully immutable".
  *(Ref: ethereum.org security guidelines; ScienceDirect SCSVS checklist)*

- Deployment transaction (with deployer address and constructor args) linked or logged in
  README or repo; lets a reviewer independently confirm the live address and initial state.
  *(Ref: Circle Smart Contract Patterns — https://developers.circle.com/verite/smart-contract-patterns; QuickNode verification guide)*

- On-chain supply cap, lock date, or burn rate matches README claim when checked against
  block explorer state at any point in time — not a one-time screenshot, but a verifiable
  on-chain variable.
  *(Ref: ethereum.org security guidelines; Yos Riady — https://yos.io/2019/11/10/smart-contract-development-best-practices/)*

---

## Mid

- Contract is verified on-chain but owner/admin powers are not documented in README; a
  reviewer has to read the contract ABI to discover what the owner key can do.
  *(Ref: ethereum.org security guidelines; ScienceDirect SCSVS checklist)*

- Mechanic works as described in the happy path, but edge cases are undocumented — e.g.,
  what happens to a tip if the recipient's address is a contract that reverts, or what the
  burn function does on a zero-value call.
  *(Ref: ethereum.org security guidelines; Yos Riady best practices)*

- README mentions "reviewed by a friend" or links to a self-conducted audit without a
  third-party report; not independently verifiable, but not a fabricated claim either.
  *(Ref: ScienceDirect SCSVS checklist; cryptorbix DeFi safety playbook — https://cryptorbix.com/en/b/defi-safety-playbook-staking-best-practices-yield-farming-risk-controls-audit-checklists)*

- Contract verified but README deployment address is outdated; a stale address requires a
  reviewer to hunt through GitHub history or Issues to find the live contract.
  *(Ref: QuickNode verification guide; Circle smart contract patterns)*

- Pause or emergency-stop function exists and is visible in the contract; README does not
  mention it but does not claim the contract is immutable — an omission rather than a
  false claim.
  *(Ref: ethereum.org security guidelines; Kaia Docs best practices)*

- Supply or burn parameters are set at deploy time via constructor arguments; README
  documents the intended values but not how to verify the constructor args used in the
  actual deployment.
  *(Ref: Circle smart contract patterns; QuickNode verification guide)*

---

## Low

- Contract is unverified on the block explorer (bytecode only, no readable source);
  README describes fund-moving behavior but a reviewer cannot confirm what the deployed
  code actually does.
  *(Ref: QuickNode verification guide; Circle smart contract patterns)*

- README states a fixed burn rate, supply cap, or lock schedule that contradicts the
  value readable in the deployed contract's state variables.
  *(Ref: ethereum.org security guidelines; ScienceDirect SCSVS checklist)*

- An unrestricted `mint()` or `withdraw()` function exists with no owner check, no cap,
  and no mention in README — discoverable by reading the contract ABI.
  *(Ref: ethereum.org security guidelines; OWASP SCSVS — https://securing.github.io/SCSVS/SCSVS_v1.1.pdf)*

- README describes the contract as "immutable" or "no admin keys" while the deployed
  contract contains an `onlyOwner` function that can pause, drain, or change a key parameter.
  *(Ref: ethereum.org security guidelines; Kaia Docs best practices)*

- Multiple contract addresses in README with no indication which is current/live; a
  reviewer cannot determine which deployment is active without external investigation.
  *(Ref: QuickNode verification guide; Circle smart contract patterns)*

- Deployment address links to an unrelated or empty contract on the explorer — possibly a
  wrong chain, testnet address, or copy-paste error — and no Issues acknowledge the discrepancy.
  *(Ref: QuickNode verification guide)*

---

## Common Mistakes Reviewers Make

1. **Applying protocol-grade expectations to single-contract apps.**
   A small tipping app with a verified contract, documented owner powers, and no false
   immutability claim earns High even without a multisig or timelock. Those are
   proportionate to protocols managing significant TVL, not a fee-collection script.
   *(Ref: ethereum.org security guidelines; Yos Riady best practices)*

2. **Treating contract verification as sufficient without checking claims.**
   A verified contract scores nothing if the README's stated burn rate or supply cap
   doesn't match the deployed state. Verification proves the source is readable; it
   doesn't confirm the claims in the README are accurate.
   *(Ref: QuickNode verification guide; Circle smart contract patterns)*

3. **Crediting an audit mention without checking scope.**
   A linked audit report that covers only "transfer logic" and explicitly excludes the
   owner/admin path tells a reviewer very little about admin-risk posture. The audit
   citation is Mid at best if the relevant mechanic is out of scope.
   *(Ref: ScienceDirect SCSVS checklist; cryptorbix DeFi safety playbook)*

---

## Reference Sources

| Source | URL |
|---|---|
| ethereum.org — Smart contract security guidelines | https://ethereum.org/ru/developers/tutorials/smart-contract-security-guidelines/ |
| QuickNode — 5 Ways to Verify a Smart Contract | https://www.quicknode.com/guides/ethereum-development/smart-contracts/different-ways-to-verify-smart-contract-code |
| Kaia Docs — Smart Contract Security Best Practices | https://docs.kaia.io/build/best-practices/smart-contract-security-best-practices/ |
| Circle — Smart Contract Patterns | https://developers.circle.com/verite/smart-contract-patterns |
| arXiv — Secure and Efficient Smart Contract Upgrades | https://arxiv.org/html/2504.09652v1 |
| ScienceDirect — Security Checklists for Ethereum Smart Contracts (SCSVS) | https://www.sciencedirect.com/science/article/pii/S2096720925000946 |
| Yos Riady — Smart Contract Development Best Practices | https://yos.io/2019/11/10/smart-contract-development-best-practices/ |
| cryptorbix — DeFi Safety Playbook | https://cryptorbix.com/en/b/defi-safety-playbook-staking-best-practices-yield-farming-risk-controls-audit-checklists |
| OpenSSF Scorecard | https://github.com/ossf/scorecard |
| OWASP Smart Contract Security Verification Standard (SCSVS) | https://securing.github.io/SCSVS/SCSVS_v1.1.pdf |
