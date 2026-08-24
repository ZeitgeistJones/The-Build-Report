/**
 * Desk pins for special occasions — when overnight commit volume would bury
 * a real institutional story. Applied at render time (survives regen of other
 * desks; regenerate of the pinned desk still yields to this copy until removed).
 */
import type { ExternalBriefAccountId, ExternalBriefData } from '@/lib/externalOwnerBrief'

export type YbEditorialMedia = {
  /** Full-width lead visual (e.g. the Base “Do you see it?” graphic). */
  heroSrc: string
  heroAlt: string
  /** Small scannable QR — secondary to the hero, not equal weight. */
  qrSrc?: string
  docsUrl: string
  docsLabel: string
  caption: string
}

export type YbEditorialOverride = {
  dateKey: string
  /** Force this desk into the lead slot. */
  leadAccountId: ExternalBriefAccountId
  leadKicker?: string
  headline: string
  headlineNormie?: string
  deck: string
  deckNormie?: string
  /** Body paragraphs (dev / default voice). */
  paragraphs: string[]
  /** Plain-English body; falls back to paragraphs when omitted. */
  paragraphsNormie?: string[]
  media?: YbEditorialMedia
}

/**
 * Active pins. Remove an entry once the edition no longer needs a desk override.
 */
export const YB_EDITORIAL_OVERRIDES: readonly YbEditorialOverride[] = [
  {
    dateKey: '2026-08-23',
    leadAccountId: 'base',
    leadKicker: 'Lead story',
    headline: 'BASE HIDES THE MARKET IN PLAIN SIGHT',
    headlineNormie: 'BASE HID THE STOCK MARKET IN A PICTURE',
    deck: 'A Where’s-Waldo Base graphic hid a QR code that opens tokenized-stocks docs — landed in a single commit.',
    deckNormie:
      'Base hid a QR code in a busy picture. It leads to docs for stocks that now trade onchain.',
    paragraphs: [
      'Yesterday Base posted a crowded “Do you see it?” illustration — a Where’s-Waldo city of builders, memes, and “Alpha in plain sight” signage — and dared the timeline to hunt. Buried in the bottom-left corner was a QR code. Scan it and you don’t get a meme prize. You get the new Base documentation for building with tokenized stock assets: real-world equities brought onchain as asset-backed tokens, with guidance for apps that want to integrate them.',
      'That Easter egg was the showmanship. The product story landed beside it. Coinbase Tokenized Stocks are live on Base: available 24/7, 365 days a year; composable across Base DeFi; with the underlying share held 1:1 in a regulated trust. More names are coming. For an L2 that has spent years arguing onchain should absorb the real economy, this is not a side quest — it is the thesis showing up as inventory.',
      'For this desk, the overnight ledger told a different joke. One repo. One commit. A documentation page for financial primitives and integration patterns. Under the usual Daily Loop ranking — commit volume, shipping noise, “who touched the most files” — Base finished near the bottom of the paper. That formula is fine for catching agent thrash and repo churn. It is blind to institutional gravity. Yesterday’s biggest story on Base did not look like a busy GitHub day. It looked like a scavenger hunt.',
      'Read the mismatch carefully. The tweet did the culture work: make people look. The docs did the builder work: how B20-style asset rails, multipliers, compliance hooks, and price feeds fit together for apps that want to touch equities without pretending a random ERC-20 is a share. The market announcement did the capital-markets work: stocks that settle onchain and plug into DeFi instead of waiting for Monday’s open. Three beats, one day, one QR in the corner tying the graphic to the map.',
      'If you only skim headlines, you will remember “tokenized stocks on Base.” If you follow the picture, you get why the packaging mattered. Base did not lead with a whitepaper PDF. It hid the door in a crowd scene and let the curious find the builder docs first. That is a media move as much as a markets move — and on a paper that usually crowns whoever committed hardest overnight, it is also a reminder: sometimes the lead story is the one with the quietest diff.',
      'This report is unofficial and not affiliated with Base or Coinbase.',
    ],
    paragraphsNormie: [
      'Yesterday Base posted a busy “Do you see it?” picture — a packed little city of builders and memes — and asked people to look closer. In the bottom-left corner was a QR code. It doesn’t open a joke. It opens new Base docs for tokenized stocks: real company shares represented onchain, with notes for apps that want to use them.',
      'The product news matched the stunt. Coinbase Tokenized Stocks are live on Base — trade around the clock, plug into Base DeFi, backed 1:1 by shares sitting in a regulated trust. More tickers are coming. For a chain that keeps saying the real economy should move onchain, this is the idea showing up as something you can actually touch.',
      'Our paper usually ranks stories by how much code shipped overnight. By that score, Base had a tiny day: one repo, one commit — basically a docs page. That ranking missed the plot. The biggest Base story of the day did not look busy on GitHub. It looked like a scavenger hunt.',
      'Three things happened at once. The tweet made people hunt. The docs told builders how to integrate. The market launch put stocks onchain next to DeFi. The QR in the corner ties the picture to the map.',
      'So if you only catch the headline, you’ll remember “stocks on Base.” If you follow the picture, you’ll see why they hid the door in plain sight — and why a quiet commit can still be the lead.',
      'This report is unofficial and not affiliated with Base or Coinbase.',
    ],
    media: {
      heroSrc: '/daily-loop/base-do-you-see-it.jpg',
      heroAlt: 'Base’s crowded “Do you see it?” illustration — alpha in plain sight',
      qrSrc: '/daily-loop/base-tokenized-stocks-qr.png',
      docsUrl: 'https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base',
      docsLabel: 'Tokenized Stocks on Base',
      caption:
        'The QR is in the bottom-left of the graphic. Scan below for the docs — or open the link.',
    },
  },
]

export function getYbEditorialOverride(dateKey: string | null | undefined): YbEditorialOverride | null {
  if (!dateKey) return null
  return YB_EDITORIAL_OVERRIDES.find(o => o.dateKey === dateKey) ?? null
}

/** Merge pin copy onto a cached brief for display (does not write Redis). */
export function applyYbEditorialCopy(
  brief: ExternalBriefData,
  override: YbEditorialOverride,
): ExternalBriefData {
  return {
    ...brief,
    headline: override.headline,
    headlineNormie: override.headlineNormie ?? override.headline,
    deck: override.deck,
    deckNormie: override.deckNormie ?? override.deck,
    general: override.paragraphs.join('\n\n'),
    generalNormie: (override.paragraphsNormie ?? override.paragraphs).join('\n\n'),
    significance: Math.max(brief.significance ?? 0, 5),
  }
}

/** Move the pinned desk to front; keep relative order of the rest. */
export function pinYbLeadAccount(orderedIds: string[], leadAccountId: string): string[] {
  if (!orderedIds.includes(leadAccountId)) return orderedIds
  return [leadAccountId, ...orderedIds.filter(id => id !== leadAccountId)]
}
