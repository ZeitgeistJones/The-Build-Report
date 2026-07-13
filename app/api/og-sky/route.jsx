// app/api/og-sky/route.jsx
// Generates a 1200×630 OG image for /sky social cards
import { ImageResponse } from "next/og";

export const runtime = "edge";

// Same deterministic random as the component
function rand(seed) {
  const x = Math.sin(seed * 999.7) * 43758.5453;
  return x - Math.floor(x);
}

const COLORS = [
  "#5EEAD4", "#67E8F9", "#A78BFA", "#FCD34D", "#F0ABFC",
  "#FB923C", "#93C5FD", "#86EFAC", "#FDA4AF", "#C4B5FD", "#94A3B8",
];

export async function GET() {
  // Generate ~120 dots scattered across the image
  const dots = Array.from({ length: 120 }, (_, i) => ({
    x: 80 + rand(i * 3.1) * 1040,
    y: 100 + rand(i * 5.7) * 430,
    size: 2 + rand(i * 1.9) * 5,
    color: COLORS[Math.floor(rand(i * 7.3) * COLORS.length)],
    opacity: 0.3 + rand(i * 2.3) * 0.5,
  }));

  // Background stars (tiny white dots)
  const bgStars = Array.from({ length: 60 }, (_, i) => ({
    x: rand(i * 4.1 + 100) * 1200,
    y: rand(i * 6.3 + 100) * 630,
    size: 1 + rand(i * 2.1 + 100) * 1.5,
    opacity: 0.15 + rand(i * 3.7 + 100) * 0.25,
  }));

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0c1929 0%, #060d17 50%, #030810 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Background stars */}
        {bgStars.map((s, i) => (
          <div
            key={`bg-${i}`}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              background: "white",
              opacity: s.opacity,
            }}
          />
        ))}

        {/* Colored dots representing repos */}
        {dots.map((d, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.x,
              top: d.y,
              width: d.size,
              height: d.size,
              borderRadius: "50%",
              background: d.color,
              opacity: d.opacity,
              boxShadow: `0 0 ${d.size * 2}px ${d.color}44`,
            }}
          />
        ))}

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 14,
              letterSpacing: 6,
              color: "rgba(94,234,212,0.6)",
              textTransform: "uppercase",
              marginBottom: 12,
              fontWeight: 500,
            }}
          >
            The CLAWD Ecosystem
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 200,
              color: "rgba(255,255,255,0.9)",
              letterSpacing: 2,
              marginBottom: 16,
            }}
          >
            The Ecosystem Sky
          </div>
          <div
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: 1.5,
            }}
          >
            200+ repos · one autonomous builder · tap a star to explore
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
