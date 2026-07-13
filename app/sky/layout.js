// app/sky/layout.js
// Metadata for the /sky route — OG tags, title, etc.

export const metadata = {
  title: "The CLAWD Ecosystem Sky",
  description:
    "An interactive constellation map of every repo in the clawdbotatg ecosystem. 200+ projects, one autonomous builder.",
  openGraph: {
    title: "The CLAWD Ecosystem Sky",
    description:
      "200+ repos. One autonomous builder. Tap a star to explore the ecosystem.",
    type: "website",
    images: ["/api/og-sky"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The CLAWD Ecosystem Sky",
    description:
      "200+ repos. One autonomous builder. Tap a star to explore the ecosystem.",
    images: ["/api/og-sky"],
  },
};

export default function SkyLayout({ children }) {
  return children;
}
