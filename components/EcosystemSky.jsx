"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// --- Static config ---

const CAT_META = {
  "token-econ":  { label: "Token & Economy", core: "#5EEAD4", glow: "rgba(94,234,212,0.55)" },
  "onchain":     { label: "Onchain / Contracts", core: "#67E8F9", glow: "rgba(103,232,249,0.5)" },
  "agent-infra": { label: "Agent Infra", core: "#A78BFA", glow: "rgba(167,139,250,0.5)" },
  "devtools":    { label: "Dev Tools", core: "#FCD34D", glow: "rgba(252,211,77,0.5)" },
  "media":       { label: "Media & Streaming", core: "#F0ABFC", glow: "rgba(240,171,252,0.5)" },
  "governance":  { label: "Governance & Scoring", core: "#FB923C", glow: "rgba(251,146,60,0.5)" },
  "research":    { label: "Research", core: "#93C5FD", glow: "rgba(147,197,253,0.5)" },
  "mobile":      { label: "Mobile / On-device", core: "#86EFAC", glow: "rgba(134,239,172,0.5)" },
  "games":       { label: "Games", core: "#FDA4AF", glow: "rgba(253,164,175,0.5)" },
  "community":   { label: "Community", core: "#C4B5FD", glow: "rgba(196,181,253,0.5)" },
  "misc":        { label: "Misc / Experiments", core: "#94A3B8", glow: "rgba(148,163,184,0.45)" },
};
const CAT_ORDER = Object.keys(CAT_META);

const TOUR_STOPS = [
  { repo: "bot-wallet-guide",   caption: "Where it begins. A manifesto: why crypto, why bots." },
  { repo: "clawd-vesting",       caption: "The first mechanic. Lock up CLAWD, let it drip back." },
  { repo: "leftclaw-services",   caption: "A marketplace forms. Hire an AI builder, pay in tokens." },
  { repo: "agent-bounty-board",  caption: "Agents auctioning to agents. Dutch auction jobs." },
  { repo: "clawd-larvae",        caption: "The brood. Spawn, talk, kill — the work persists." },
  { repo: "slop-computer-live",  caption: "A podcast becomes a place. A Mac OS 9 desktop, live." },
  { repo: "clawdviction",        caption: "Governance evolves. Stake, train, delegate to your AI." },
  { repo: "clawd-chronicle",     caption: "The story keeps writing itself. Star by star." },
];

const FAMILY_PREFIXES = [
  { prefix: "slop-computer", label: "slop.computer" },
  { prefix: "slop-circle", label: "slop.computer" },
  { prefix: "zk-llm", label: "ZK LLM" },
  { prefix: "zk-api-credits", label: "ZK Credits" },
  { prefix: "zkllmapi", label: "zkllmapi" },
  { prefix: "clawd-fomo3d", label: "Fomo3D" },
  { prefix: "clawdfomo", label: "Fomo3D" },
  { prefix: "clawd-DSA-LCS", label: "DSA/LCS Pipeline" },
  { prefix: "clawd-viction", label: "ClawdViction" },
  { prefix: "clawd-games", label: "ClawdGames" },
  { prefix: "guest-book", label: "Guest Book" },
  { prefix: "guestbook", label: "Guest Book" },
  { prefix: "clawd-raffle", label: "Raffle" },
  { prefix: "builder-agent", label: "Builder Agent" },
  { prefix: "clawd-builder", label: "Builder Agent" },
  { prefix: "leftclaw-services", label: "LeftClaw Services" },
  { prefix: "leftclaw-example", label: "LeftClaw Services" },
  { prefix: "clawd-pfp", label: "PFP System" },
  { prefix: "burn-", label: "Burn Mechanism" },
  { prefix: "clawd-burn", label: "Burn Mechanism" },
  { prefix: "receiver-buy-and-burn", label: "Burn Mechanism" },
  { prefix: "couture", label: "Couture" },
];

const EXPLICIT_LINKS = [
  { a: "clawd-vesting", b: "clawd-token-hub", label: "$CLAWD Token" },
  { a: "clawd-vesting", b: "clawdviction", label: "Staking → Governance" },
  { a: "clawdviction", b: "clawd-conclave", label: "Conviction Voting" },
  { a: "agent-bounty-board", b: "leftclaw-services", label: "Job Marketplace" },
  { a: "agent-bounty-board", b: "register-8004", label: "ERC-8004" },
  { a: "howto8004", b: "register-8004", label: "ERC-8004" },
  { a: "clawd-multisig", b: "slop-computer-wallet", label: "Multisig" },
  { a: "nerve-cord", b: "clawd-larvae", label: "Multi-Agent" },
  { a: "clawd-harness", b: "clawd-console", label: "Claude Code Harness" },
  { a: "clawd-harness", b: "harness-proxy", label: "Harness System" },
  { a: "clawd-chronicle", b: "bot-wallet-guide", label: "History/Lore" },
  { a: "clawd-clipper", b: "slop-computer-live", label: "slop.computer" },
  { a: "clawd-crash", b: "clawd-lucky-click", label: "Gambling Games" },
  { a: "token-gated-chat", b: "clawd-conclave", label: "Token Gating" },
  { a: "clawdETH", b: "clawd-staking-vault", label: "Staking" },
  { a: "clawd-stake", b: "clawd-staking-vault", label: "Staking" },
  { a: "clawd-stake", b: "cv-4", label: "Staking" },
  { a: "fifth-builder", b: "yet-another-builder-agent", label: "Build Pipeline" },
  { a: "clawd-x-agent", b: "clawd-visibility", label: "X/Twitter Bot" },
  { a: "clawd-x-agent", b: "twitter-read-skill", label: "X/Twitter" },
  { a: "clawd-x-research", b: "clawd-tweet-desk", label: "X/Twitter" },
  { a: "clawd-local-md", b: "good-guy-bad-guy", label: "On-device AI" },
  { a: "clawd-scribe", b: "local-question", label: "Local-first" },
  { a: "clawd-voice", b: "clawd-video-chat", label: "Voice/Video" },
  { a: "private-voting", b: "clawd-futarchy", label: "Governance Research" },
  { a: "venice-e2ee-proxy", b: "zkllmapi-proxy", label: "Privacy Proxy" },
  { a: "papers", b: "idea-labs", label: "Research" },
  { a: "ss-triage-router", b: "clawd-job-runner", label: "LLM Routing" },
  { a: "clawd-mindshare", b: "clawd-visibility", label: "Visibility" },
  { a: "clawd-6551", b: "clawdgames", label: "Game Characters" },
  { a: "clawd-calendar", b: "clawd-scheduler", label: "Scheduling" },
  { a: "gitlawb-audit", b: "clawd-one-dollar-audit", label: "Auditing" },
  { a: "clawd-agent-launcher", b: "clawd-services", label: "x402 Agents" },
  { a: "slop-computer-ai-wallet", b: "slop-computer-wallet", label: "slop.computer" },
];

// --- Helpers ---

function rand(seed) {
  const x = Math.sin(seed * 999.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildConnections(repos) {
  const names = new Set(repos.map((r) => r.n));
  const edges = new Map();
  const edgeKey = (a, b) => [a, b].sort().join("|");

  const familyMap = {};
  repos.forEach((r) => {
    FAMILY_PREFIXES.forEach((fp) => {
      if (r.n.startsWith(fp.prefix) || r.n === fp.prefix) {
        if (!familyMap[fp.label]) familyMap[fp.label] = [];
        familyMap[fp.label].push(r.n);
      }
    });
  });
  Object.entries(familyMap).forEach(([label, members]) => {
    const unique = [...new Set(members)];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const k = edgeKey(unique[i], unique[j]);
        if (!edges.has(k)) edges.set(k, { a: unique[i], b: unique[j], label });
      }
    }
  });

  EXPLICIT_LINKS.forEach(({ a, b, label }) => {
    if (names.has(a) && names.has(b)) {
      const k = edgeKey(a, b);
      if (!edges.has(k)) edges.set(k, { a, b, label });
    }
  });

  return [...edges.values()];
}

function timeAgo(isoString) {
  if (!isoString) return "";
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// --- Component ---

export default function EcosystemSky() {
  // Data
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState(null);

  // UI
  const [selected, setSelected] = useState(null);
  const [hoveredCat, setHoveredCat] = useState(null);
  const [hoveredStar, setHoveredStar] = useState(null);
  const [query, setQuery] = useState("");
  const [time, setTime] = useState(0);
  const [dimensions, setDimensions] = useState({ w: 1000, h: 700 });
  const [touring, setTouring] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [legendOpen, setLegendOpen] = useState(false);
  const containerRef = useRef(null);

  const isMobile = dimensions.w < 640;

  // --- Fetch repos ---
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ecosystem-repos")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.repos && data.repos.length > 0) {
          setRepos(data.repos);
          setSyncedAt(data.generatedAt);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch ecosystem repos:", err);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // --- Deep-link: read hash on mount ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (hash) setSelected(hash);

    const onHashChange = () => {
      const h = window.location.hash.replace("#", "");
      setSelected(h || null);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // --- Deep-link: write hash on select ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selected) {
      window.history.replaceState(null, "", `#${selected}`);
    } else {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [selected]);

  // --- Resize ---
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setDimensions({ w: r.width, h: r.height });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // --- Animation ---
  useEffect(() => {
    let frame;
    const tick = () => {
      setTime((t) => t + 0.006);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // --- Tour ---
  useEffect(() => {
    if (!touring) return;
    const timer = setTimeout(() => {
      if (tourIndex < TOUR_STOPS.length - 1) {
        const next = tourIndex + 1;
        setTourIndex(next);
        setSelected(TOUR_STOPS[next].repo);
      } else {
        setTouring(false);
      }
    }, 4400);
    return () => clearTimeout(timer);
  }, [touring, tourIndex]);

  const startTour = () => {
    setTouring(true);
    setTourIndex(0);
    setSelected(TOUR_STOPS[0].repo);
  };

  // --- Computed data ---

  const connections = useMemo(() => buildConnections(repos), [repos]);

  const clusterCenters = useMemo(() => {
    const counts = {};
    repos.forEach((r) => (counts[r.c] = (counts[r.c] || 0) + 1));
    const centers = {};
    let angle = -Math.PI / 2;
    CAT_ORDER.forEach((cat, i) => {
      const frac = (counts[cat] || 0) / (repos.length || 1);
      const a = angle + Math.PI * frac + 0.15;
      const radius = 0.32 + (i % 2 === 0 ? 0.03 : -0.03);
      centers[cat] = {
        x: 0.5 + Math.cos(angle + (a - angle) / 2) * radius,
        y: 0.5 + Math.sin(angle + (a - angle) / 2) * radius * 0.85,
      };
      angle = a;
    });
    return centers;
  }, [repos]);

  const positioned = useMemo(() => {
    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    const byCategory = {};
    repos.forEach((r) => {
      if (!byCategory[r.c]) byCategory[r.c] = [];
      byCategory[r.c].push(r);
    });
    const out = [];
    Object.entries(byCategory).forEach(([cat, list]) => {
      const center = clusterCenters[cat] || { x: 0.5, y: 0.5 };
      const sorted = [...list].sort((a, b) => (b.s + b.f) - (a.s + a.f));
      const n = sorted.length;
      const maxRadius = 0.06 + Math.sqrt(n / 10) * 0.09;
      sorted.forEach((r, i) => {
        const seed = r.n.length * 7 + i * 13 + cat.length;
        const angle = i * GOLDEN_ANGLE;
        const frac = Math.sqrt(i / Math.max(n - 1, 1));
        const rr = 0.012 + frac * maxRadius;
        const jx = (rand(seed) - 0.5) * 0.012;
        const jy = (rand(seed + 3) - 0.5) * 0.012;
        out.push({
          ...r,
          x: center.x + Math.cos(angle) * rr + jx,
          y: center.y + Math.sin(angle) * rr + jy,
          seed,
          catRank: i + 1,
          catTotal: n,
        });
      });
    });
    return out;
  }, [repos, clusterCenters]);

  // --- Derived state ---

  const q = query.trim().toLowerCase();
  const matchesQuery = useCallback(
    (r) => !q || r.n.toLowerCase().includes(q) || (r.d && r.d.toLowerCase().includes(q)),
    [q]
  );

  const getPos = useCallback(
    (p) => {
      const drift = 2.2;
      return {
        x: p.x * dimensions.w + Math.sin(time * 0.6 + p.seed) * drift,
        y: p.y * dimensions.h + Math.cos(time * 0.45 + p.seed * 1.3) * drift,
      };
    },
    [time, dimensions]
  );

  const selectedRepo = selected ? positioned.find((r) => r.n === selected) : null;
  const searchActive = q.length > 0;

  const activeConns = selected
    ? connections.filter((c) => c.a === selected || c.b === selected)
    : [];
  const connectedNames = new Set(activeConns.flatMap((c) => [c.a, c.b]));

  // --- Loading screen ---
  if (loading) {
    return (
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
          fontFamily: "'Inter','SF Pro Display',-apple-system,sans-serif",
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
        <div style={{ color: "rgba(94,234,212,0.5)", fontSize: 11, letterSpacing: 4, textTransform: "uppercase" }}>
          Loading the sky
        </div>
        <style>{`@keyframes skyspin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // --- Empty state ---
  if (repos.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: "#030810",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter',sans-serif",
          color: "rgba(255,255,255,0.4)",
          fontSize: 14,
        }}
      >
        Couldn't reach the stars. Try refreshing.
      </div>
    );
  }

  // --- Main render ---
  return (
    <div
      ref={containerRef}
      onClick={() => {
        setSelected(null);
        setTouring(false);
      }}
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: 500,
        background: "radial-gradient(ellipse at 50% 30%, #0c1929 0%, #060d17 55%, #030810 100%)",
        overflow: "hidden",
        fontFamily: "'Inter','SF Pro Display',-apple-system,sans-serif",
        userSelect: "none",
      }}
    >
      {/* Back link */}
      <a
        href="/"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 22,
          left: 22,
          zIndex: 25,
          fontSize: 11,
          color: "rgba(94,234,212,0.4)",
          textDecoration: "none",
          letterSpacing: 0.5,
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(94,234,212,0.85)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(94,234,212,0.4)")}
      >
        ← The Build Report
      </a>

      {/* Title + search/tour */}
      <div
        style={{
          position: "absolute",
          top: 22,
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: 5, color: "rgba(94,234,212,0.5)", textTransform: "uppercase", marginBottom: 5, fontWeight: 500 }}>
          The CLAWD Ecosystem
        </div>
        <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 200, color: "rgba(255,255,255,0.85)", letterSpacing: 1.5 }}>
          {repos.length} Repos, One Autonomous Builder
        </div>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: 12, display: "flex", justifyContent: "center", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "auto" }}
        >
          {touring ? (
            <>
              <div
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontStyle: "italic",
                  fontSize: isMobile ? 13 : 15,
                  color: "rgba(240, 220, 180, 0.85)",
                  letterSpacing: 0.3,
                  textAlign: "center",
                  maxWidth: 480,
                  padding: "0 20px",
                  minHeight: 22,
                  textShadow: "0 0 12px rgba(0,0,0,0.7)",
                }}
              >
                {TOUR_STOPS[tourIndex].caption}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {TOUR_STOPS.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: i === tourIndex ? "rgba(240,220,180,0.85)" : "rgba(255,255,255,0.15)",
                      transition: "background 0.3s",
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search the sky..."
              style={{
                width: isMobile ? 200 : 240,
                padding: "7px 14px",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.04)",
                color: "white",
                fontSize: 12,
                outline: "none",
                letterSpacing: 0.5,
                textAlign: "center",
              }}
            />
          )}
        </div>
      </div>

      {/* Chronicle button */}
      {!touring && !selected && (
        <button
          onClick={(e) => { e.stopPropagation(); startTour(); }}
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            zIndex: 25,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: isMobile ? 10 : 12,
            letterSpacing: 2,
            color: "rgba(240, 220, 180, 0.7)",
            background: "rgba(240, 220, 180, 0.04)",
            border: "1px solid rgba(240, 220, 180, 0.25)",
            padding: isMobile ? "6px 12px" : "7px 16px",
            borderRadius: 20,
            cursor: "pointer",
            textTransform: "uppercase",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(240, 220, 180, 0.1)"; e.currentTarget.style.color = "rgba(240, 220, 180, 0.95)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(240, 220, 180, 0.04)"; e.currentTarget.style.color = "rgba(240, 220, 180, 0.7)"; }}
        >
          ▸ Chronicle
        </button>
      )}

      {/* Nebula glow */}
      <div style={{ position: "absolute", top: "15%", left: "15%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(94,234,212,0.035) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "12%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.035) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />

      {/* Background stars */}
      <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
        {Array.from({ length: 90 }, (_, i) => (
          <circle
            key={i}
            cx={`${rand(i * 3.1) * 100}%`}
            cy={`${rand(i * 5.7) * 100}%`}
            r={rand(i * 1.9) * 1.3 + 0.3}
            fill="white"
            opacity={(rand(i * 2.3) * 0.4 + 0.1) * (0.6 + 0.4 * Math.sin(time * 2 + i))}
          />
        ))}
      </svg>

      {/* Shooting stars */}
      <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
        <defs>
          <linearGradient id="streak">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="60%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => {
          const cycle = 9 + i * 4.7;
          const phase = (time + i * 3.1) % cycle;
          if (phase >= 0.8) return null;
          const progress = phase / 0.8;
          const startX = 15 + i * 30 + rand(i * 77) * 20;
          const startY = 5 + rand(i * 33) * 25;
          const x = startX + progress * 25;
          const y = startY + progress * 15;
          return (
            <line key={i} x1={`${x - 4}%`} y1={`${y - 2.5}%`} x2={`${x}%`} y2={`${y}%`}
              stroke="url(#streak)" strokeWidth={1.2} opacity={Math.sin(progress * Math.PI) * 0.7} />
          );
        })}
      </svg>

      {/* Connection lines */}
      {selected && activeConns.length > 0 && (
        <svg width={dimensions.w} height={dimensions.h}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 8 }}>
          <defs>
            <filter id="conn-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {activeConns.map((conn, i) => {
            const rA = positioned.find((p) => p.n === conn.a);
            const rB = positioned.find((p) => p.n === conn.b);
            if (!rA || !rB) return null;
            const posA = getPos(rA);
            const posB = getPos(rB);
            const meta = CAT_META[rA.n === selected ? rA.c : rB.c];
            const midX = (posA.x + posB.x) / 2;
            const midY = (posA.y + posB.y) / 2;
            return (
              <g key={i}>
                <line x1={posA.x} y1={posA.y} x2={posB.x} y2={posB.y}
                  stroke={meta.core} strokeWidth={1.2} opacity={0.45} filter="url(#conn-glow)" />
                {!isMobile && (
                  <text x={midX} y={midY - 5} fill={meta.core} fontSize={8.5}
                    textAnchor="middle" opacity={0.6} fontFamily="inherit">
                    {conn.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* Repo stars */}
      {positioned.map((r) => {
        const pos = getPos(r);
        const meta = CAT_META[r.c];
        const isSel = selected === r.n;
        const isHovered = hoveredStar === r.n;
        const isConnected = connectedNames.has(r.n);
        const catHighlighted = hoveredCat === r.c;
        const searchMatch = matchesQuery(r);
        const dimmed =
          (searchActive && !searchMatch) ||
          (!searchActive && hoveredCat && !catHighlighted) ||
          (selected && !isSel && !isConnected);

        const weight = Math.log2(r.s + r.f + 2);
        const baseSize = 5 + weight * 3.2;
        const size = baseSize * (isSel ? 1.6 : 1);
        const pulse = 1 + Math.sin(time * 2.2 + r.seed * 6) * 0.12;

        return (
          <div
            key={r.n}
            onClick={(e) => { e.stopPropagation(); setSelected(selected === r.n ? null : r.n); }}
            onMouseEnter={() => { setHoveredCat(r.c); setHoveredStar(r.n); }}
            onMouseLeave={() => { setHoveredCat(null); setHoveredStar(null); }}
            style={{
              position: "absolute",
              left: pos.x - size / 2,
              top: pos.y - size / 2,
              width: size,
              height: size,
              cursor: "pointer",
              zIndex: isSel ? 30 : isHovered ? 15 : 5,
              opacity: dimmed ? 0.12 : 1,
              transition: "opacity 0.3s ease",
            }}
          >
            {/* Outer glow */}
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: size * (isSel ? 3 : 2.2) * pulse, height: size * (isSel ? 3 : 2.2) * pulse,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${meta.glow} 0%, transparent 70%)`,
              opacity: isSel ? 0.9 : 0.45,
            }} />
            {/* Core */}
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: size * 0.55, height: size * 0.55, borderRadius: "50%",
              background: meta.core,
              boxShadow: `0 0 ${size * 0.6}px ${meta.glow}`,
            }} />
            {/* Hover label */}
            {(isHovered || isSel) && (
              <div style={{
                position: "absolute",
                top: size + 4,
                left: "50%",
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                fontSize: isSel ? 11 : 10,
                fontWeight: isSel ? 600 : 400,
                color: isSel ? meta.core : "rgba(255,255,255,0.65)",
                textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                pointerEvents: "none",
              }}>
                {r.n}
              </div>
            )}
          </div>
        );
      })}

      {/* Detail panel */}
      {selectedRepo && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(6,13,23,0.94)",
            border: `1px solid ${CAT_META[selectedRepo.c].core}33`,
            borderRadius: 12,
            padding: isMobile ? "14px 16px" : "16px 22px",
            maxWidth: 440,
            width: "calc(100% - 48px)",
            zIndex: 40,
            backdropFilter: "blur(20px)",
            maxHeight: isMobile ? "40vh" : "auto",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: CAT_META[selectedRepo.c].core,
              boxShadow: `0 0 8px ${CAT_META[selectedRepo.c].glow}`,
            }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "white", letterSpacing: 0.3, wordBreak: "break-word" }}>
              {selectedRepo.n}
            </div>
            <div style={{
              fontSize: 9, color: CAT_META[selectedRepo.c].core, textTransform: "uppercase",
              letterSpacing: 1.5, opacity: 0.75, marginLeft: "auto", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {selectedRepo.catRank} of {selectedRepo.catTotal} · {CAT_META[selectedRepo.c].label}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.55, minHeight: 18 }}>
            {selectedRepo.d || "No description yet."}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>{selectedRepo.l || "no language"}</span>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>★ {selectedRepo.s}</span>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>⑂ {selectedRepo.f}</span>
            <a
              href={selectedRepo.u}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: "auto", fontSize: 11, color: CAT_META[selectedRepo.c].core,
                textDecoration: "none", border: `1px solid ${CAT_META[selectedRepo.c].core}44`,
                padding: "3px 10px", borderRadius: 20,
              }}
            >
              view on GitHub →
            </a>
          </div>
          {activeConns.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {activeConns.map((conn, i) => {
                const other = conn.a === selectedRepo.n ? conn.b : conn.a;
                return (
                  <div
                    key={i}
                    onClick={() => setSelected(other)}
                    style={{
                      fontSize: 9.5, padding: "3px 9px", borderRadius: 16,
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)", cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    {conn.label} → {other}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend — full on desktop, toggle on mobile */}
      {isMobile && !selected && (
        <button
          onClick={(e) => { e.stopPropagation(); setLegendOpen(!legendOpen); }}
          style={{
            position: "absolute", bottom: 20, right: 20, zIndex: 25,
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
            display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center",
            gap: 2, padding: 7, cursor: "pointer",
          }}
        >
          {CAT_ORDER.slice(0, 4).map((cat) => (
            <div key={cat} style={{ width: 4, height: 4, borderRadius: "50%", background: CAT_META[cat].core }} />
          ))}
        </button>
      )}
      {((!isMobile) || legendOpen) && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: isMobile ? 60 : 20,
            right: 20,
            display: "flex",
            flexDirection: "column",
            gap: 5,
            opacity: selected ? 0.15 : 1,
            transition: "opacity 0.3s",
            zIndex: 20,
            ...(isMobile ? {
              background: "rgba(6,13,23,0.92)",
              backdropFilter: "blur(12px)",
              borderRadius: 10,
              padding: "10px 12px",
              border: "1px solid rgba(255,255,255,0.1)",
            } : {}),
          }}
        >
          {CAT_ORDER.map((cat) => {
            const meta = CAT_META[cat];
            const count = repos.filter((r) => r.c === cat).length;
            if (count === 0) return null;
            return (
              <div
                key={cat}
                onMouseEnter={() => setHoveredCat(cat)}
                onMouseLeave={() => setHoveredCat(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                  opacity: hoveredCat && hoveredCat !== cat ? 0.3 : 1,
                }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", background: meta.core,
                  boxShadow: `0 0 4px ${meta.glow}`,
                }} />
                <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", letterSpacing: 0.5 }}>
                  {meta.label} · {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats bar */}
      {!selected && !touring && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 12 : 20,
            pointerEvents: "none",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            `${repos.length} repos`,
            `${new Set(repos.map((r) => r.l).filter(Boolean)).size} languages`,
            `${repos.reduce((a, r) => a + r.s, 0)} ★`,
            `${connections.length} connections`,
            ...(syncedAt ? [`synced ${timeAgo(syncedAt)}`] : []),
          ].map((stat, i, arr) => (
            <span key={i}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", letterSpacing: 1 }}>{stat}</span>
              {i < arr.length - 1 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", marginLeft: isMobile ? 12 : 20 }}>·</span>}
            </span>
          ))}
        </div>
      )}

      {/* Hints */}
      {!selected && !touring && (
        <div style={{
          position: "absolute", bottom: 42, left: "50%", transform: "translateX(-50%)",
          fontSize: 10, color: "rgba(255,255,255,0.18)", letterSpacing: 0.5,
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          tap a star · hover a legend row · search by name
        </div>
      )}
      {touring && (
        <div style={{
          position: "absolute", bottom: 24, left: 24, fontSize: 10.5,
          color: "rgba(240, 220, 180, 0.4)", letterSpacing: 0.5, pointerEvents: "none",
          fontStyle: "italic", fontFamily: "Georgia, 'Times New Roman', serif",
        }}>
          tap anywhere to stop
        </div>
      )}
    </div>
  );
}
