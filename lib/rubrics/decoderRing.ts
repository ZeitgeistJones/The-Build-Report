/** Holder-facing decoder ring (from builder) — wired into autoscore prompts. */
export const ECOSYSTEM_DECODER_RING = `
Ecosystem decoder ring — score by repo type, not one universal "engagement" standard:

Burn apps (e.g. incinerator):
- Misread: no recent burns = broken or dormant.
- Fair: mechanism still callable, waiting on threshold/refill is working as designed. Quiet can mean healthy.

Locks / vesting:
- Misread: no activity = nothing happening; needs ongoing audits or commits.
- Fair: if tokens stayed locked and schedule intact, quiet = success. Score against launch promise fulfilled, not living-product maintenance. Completed set-and-forget locks can score high on on-chain commitments and user safety.

Governance / Larv.ai:
- Misread: CV staking = CLAWD payout; or "just a forum."
- Fair: conviction is signaling on what gets built; value is downstream builds, not staking yield. CLAWD lock/supply impact can score mid on direct TM; do not treat CV as CLAWD burn economics.

Infra / tools (e.g. dead-simple-agent, containers, scaffolds):
- Misread: no holder-facing UI = no value; judge like a trading app.
- Fair: infra multiplies downstream products. Low TM is normal. For BI "On-chain commitments" score architectural restraint, permission boundaries, and secrets handling — not absence of contracts.

Landing pages / marketing repos:
- Misread: polished page = finished economic product.
- Fair: low TM expected; representation ≠ on-chain routing. BI can still score transparency and ecosystem alignment.

Meta: burn apps, locks, infra, and governance have different success metrics. Applying "direct CLAWD burn" or "recent GitHub commits" as the only integrity signal will mis-score most of the ecosystem.
`.trim()
