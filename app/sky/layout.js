// app/sky/layout.js
// Metadata for the /sky route — OG tags tuned for Telegram + X/Twitter

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://the-build-report.vercel.app";

export const metadata = {
  title: "Night Sky",
  description:
    "An interactive constellation map of every repo in the clawdbotatg ecosystem. 200+ projects, one autonomous builder.",
  openGraph: {
    title: "Night Sky",
    description:
      "200+ repos. One autonomous builder. Tap a star to explore the ecosystem.",
    type: "website",
    url: `${SITE_URL}/sky`,
    images: [
      {
        url: `${SITE_URL}/api/og-sky`,
        width: 1200,
        height: 630,
        alt: "Night Sky — The CLAWD Ecosystem",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Night Sky",
    description:
      "200+ repos. One autonomous builder. Tap a star to explore the ecosystem.",
    images: [`${SITE_URL}/api/og-sky`],
  },
};

export default function SkyLayout({ children }) {
  return children;
}
