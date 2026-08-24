/**
 * Desk pins for special occasions — when overnight commit volume would bury
 * a real institutional story. Applied at render time (survives regen of other
 * desks; regenerate of the pinned desk still yields to this copy until removed).
 */
import type { ExternalBriefAccountId, ExternalBriefData } from '@/lib/externalOwnerBrief'

export type YbEditorialMedia = {
  /** Clean scannable QR pointing at docsUrl. */
  qrSrc: string
  /** Optional crop of the original Easter-egg graphic. */
  easterEggSrc?: string
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
      'Yesterday Base posted a crowded “Do you see it?” illustration and asked the timeline to hunt. Buried in the bottom-left corner was a QR code. Scan it and you don’t get a meme — you get the new Base documentation for building with tokenized stock assets: real-world equities brought onchain as asset-backed tokens, with guidance for apps that want to integrate them.',
      'Hours later the quieter half of the same story hit the wire: Coinbase Tokenized Stocks live on Base — available 24/7, composable across Base DeFi, with the underlying share held 1:1 in a regulated trust. New names coming. For a desk that usually ranks by overnight commit volume, this was the mismatch of the day: one repo, one commit, and the biggest institutional unlock on the board.',
      'The commit itself is almost shy — a documentation page for financial primitives and integration patterns. The tweet did the showmanship; the docs did the work. Builders who follow the Easter egg get the map. Everyone else gets the headline after the fact.',
      'This report is unofficial and not affiliated with Base or Coinbase.',
    ],
    paragraphsNormie: [
      'Yesterday Base posted a busy “Do you see it?” picture and asked people to look closer. In the bottom-left corner was a QR code. It doesn’t open a meme — it opens new Base docs for tokenized stocks: real company shares represented onchain, with notes for apps that want to use them.',
      'The same day, Coinbase Tokenized Stocks went live on Base — trade around the clock, plug into Base DeFi, backed 1:1 by shares in a regulated trust. More tickers coming. Our paper usually ranks by how much code shipped overnight. That formula missed the plot: one repo, one commit, biggest move of the day.',
      'The commit is a quiet docs page. The tweet was the show. Follow the Easter egg for the builder map.',
      'This report is unofficial and not affiliated with Base or Coinbase.',
    ],
    media: {
      qrSrc: '/daily-loop/base-tokenized-stocks-qr.png',
      easterEggSrc: '/daily-loop/base-waldo-qr-crop.png',
      docsUrl: 'https://docs.base.org/base-chain/asset-issuance/tokenized-stocks-on-base',
      docsLabel: 'Tokenized Stocks on Base',
      caption: 'Scan for the docs Base hid in the bottom-left of yesterday’s graphic.',
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
