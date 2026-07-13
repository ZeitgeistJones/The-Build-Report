// app/sky/page.jsx
"use client";

import dynamic from "next/dynamic";

const EcosystemSky = dynamic(() => import("@/components/EcosystemSky"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#030810",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "'Inter',sans-serif",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "2px solid rgba(94,234,212,0.15)",
          borderTop: "2px solid rgba(94,234,212,0.7)",
          borderRadius: "50%",
          animation: "skyspin 1s linear infinite",
        }}
      />
      <div
        style={{
          color: "rgba(94,234,212,0.5)",
          fontSize: 11,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        Loading the sky
      </div>
      <style>{`@keyframes skyspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

export default function SkyPage() {
  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
      <EcosystemSky />
    </div>
  );
}
