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

// Ambient bed — Space Ambient Music | No Copyright V1 (Lazor Brown)
const SKY_MUSIC_VIDEO_ID = "7GKrV3JY0Rc";
const SKY_MUSIC_VOLUME = 40;

// One-line descriptions shown on legend hover
const CAT_DESCRIPTIONS = {
  "token-econ":  "CLAWD's monetary layer — vesting, staking, burns, auctions",
  "onchain":     "Solidity, ERC-8004, and dapps that live on-chain",
  "agent-infra": "Larvae, harnesses, and the tools that let agents run agents",
  "devtools":    "Local-first utilities and daily-driver tools",
  "media":       "Video, audio, streams, and the slop.computer podcast",
  "governance":  "Scoring, auditing, and holding the ecosystem to account",
  "research":    "ZK proofs, LLM proxies, papers, and exploration",
  "mobile":      "iOS and on-device experiments",
  "games":       "Playable moments in CLAWD",
  "community":   "Delegates, badges, and the social layer",
  "misc":        "Unfinished ideas and one-off experiments",
};

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

// Generate a procedural star-surface texture — blotchy radial gradients,
// unique per repo (seeded by name), colored from its category palette.
function generateSphereTexture(name, coreColor, glowColor) {
  const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const blobs = [];
  const blobCount = 14;
  for (let i = 0; i < blobCount; i++) {
    const x = rand(seed + i * 3.1) * 100;
    const y = rand(seed + i * 5.7) * 100;
    const size = 8 + rand(seed + i * 1.9) * 22;
    const brightness = rand(seed + i * 2.3);
    // Alternate between lighter (hot) and darker (cool) blotches
    const color = brightness > 0.5
      ? `${coreColor}${Math.floor(30 + brightness * 40).toString(16).padStart(2, "0")}`
      : `#000000${Math.floor(20 + (1 - brightness) * 30).toString(16).padStart(2, "0")}`;
    blobs.push(`radial-gradient(circle at ${x}% ${y}%, ${color} 0%, transparent ${size}%)`);
  }
  return blobs.join(", ");
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
  const [dimensions, setDimensions] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1000, h: 700 }
  );
  // Reliable mobile detection — matchMedia, not first container measure
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  const [touring, setTouring] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourTarget, setTourTarget] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inspecting, setInspecting] = useState(null);
  const [musicOn, setMusicOn] = useState(true);
  const searchInputRef = useRef(null);
  const cursorGlowRef = useRef(null);
  const containerRef = useRef(null);
  const ytIframeRef = useRef(null);
  const musicOnRef = useRef(true);
  const isMobileRef = useRef(false);
  const tourFocusRef = useRef({ active: false, x: 0.5, y: 0.5 });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  const sendYtCommand = useCallback((func, args = []) => {
    const win = ytIframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube.com"
    );
  }, []);

  useEffect(() => {
    musicOnRef.current = musicOn;
  }, [musicOn]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (musicOn) {
        sendYtCommand("unMute");
        sendYtCommand("setVolume", [SKY_MUSIC_VOLUME]);
        sendYtCommand("playVideo");
      } else {
        sendYtCommand("mute");
        sendYtCommand("pauseVideo");
      }
    }, musicOn ? 500 : 0);
    return () => clearTimeout(t);
  }, [musicOn, sendYtCommand]);

  // Browsers often block unmuted autoplay — resume on first interaction if still on
  useEffect(() => {
    const kick = () => {
      if (!musicOnRef.current) return;
      sendYtCommand("unMute");
      sendYtCommand("setVolume", [SKY_MUSIC_VOLUME]);
      sendYtCommand("playVideo");
    };
    window.addEventListener("pointerdown", kick, { once: true, capture: true });
    return () => window.removeEventListener("pointerdown", kick, { capture: true });
  }, [sendYtCommand]);

  const toggleMusic = (e) => {
    e.stopPropagation();
    setMusicOn((on) => !on);
  };

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

  // Resolve TOUR_STOPS against repos that actually loaded. Exact match first,
  // then case-insensitive, then prefix/substring fuzz. Unresolvable stops are
  // skipped so the Chronicle chain always connects real, rendered stars —
  // this survives repo renames on GitHub.
  const tourStops = useMemo(() => {
    if (repos.length === 0) return [];
    const byLower = new Map(repos.map((r) => [r.n.toLowerCase(), r.n]));
    const names = repos.map((r) => r.n);
    return TOUR_STOPS.map((stop) => {
      const want = stop.repo.toLowerCase();
      if (byLower.has(want)) return { ...stop, repo: byLower.get(want) };
      const fuzzy =
        names.find((n) => n.toLowerCase().startsWith(want)) ||
        names.find((n) => n.toLowerCase().includes(want)) ||
        names.find((n) => n.length > 4 && want.includes(n.toLowerCase()));
      return fuzzy ? { ...stop, repo: fuzzy } : null;
    }).filter(Boolean);
  }, [repos]);

  // --- Tour ---
  // Tour uses tourTarget (NOT selected) so the detail card never opens mid-Chronicle.
  useEffect(() => {
    if (!touring || tourStops.length === 0) return;
    const timer = setTimeout(() => {
      if (tourIndex < tourStops.length - 1) {
        const next = tourIndex + 1;
        setTourIndex(next);
        setTourTarget(tourStops[next].repo);
      } else {
        setTouring(false);
        setTourTarget(null);
      }
    }, 4400);
    return () => clearTimeout(timer);
  }, [touring, tourIndex, tourStops]);

  const startTour = () => {
    if (tourStops.length === 0) return;
    setSelected(null);
    setInspecting(null);
    setTouring(true);
    setTourIndex(0);
    setTourTarget(tourStops[0].repo);
  };

  // --- Computed data ---

  const connections = useMemo(() => buildConnections(repos), [repos]);


  // Maxes for Night Sky size. Commit activity (r.a — 60d commits from the
  // homepage Redis snapshot, joined server-side with ZERO GitHub calls) leads
  // when present; falls back to the old stars/forks mix when the snapshot is
  // missing so the sky never degrades.
  const sizeNorm = useMemo(() => {
    let maxS = 0;
    let maxF = 0;
    let maxA = 0;
    for (const r of repos) {
      if ((r.s || 0) > maxS) maxS = r.s || 0;
      if ((r.f || 0) > maxF) maxF = r.f || 0;
      if ((r.a || 0) > maxA) maxA = r.a || 0;
    }
    return { maxS, maxF, maxA, hasActivity: maxA > 0 };
  }, [repos]);

  const sizeScore = useCallback(
    (r) => {
      const sNorm = sizeNorm.maxS > 0 ? (r.s || 0) / sizeNorm.maxS : 0;
      const fNorm = sizeNorm.maxF > 0 ? (r.f || 0) / sizeNorm.maxF : 0;
      if (!sizeNorm.hasActivity) {
        return 0.75 * sNorm + 0.25 * fNorm;
      }
      // sqrt compresses the top so one hyperactive repo doesn't dwarf the sky,
      // and lifts mid-activity repos out of the noise floor
      const aNorm = Math.sqrt((r.a || 0) / sizeNorm.maxA);
      return 0.55 * aNorm + 0.35 * sNorm + 0.1 * fNorm;
    },
    [sizeNorm]
  );

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

  // --- Camera refs for smooth zoom-on-select ---
  const cameraRef = useRef({ x: 0.5, y: 0.5, zoom: 1 });
  const targetRef = useRef({ x: 0.5, y: 0.5, zoom: 1 });

  const getPos = useCallback(
    (p) => {
      const drift = 2.2;
      const cam = cameraRef.current;
      // World-space position with drift
      const wx = p.x + Math.sin(time * 0.6 + p.seed) * (drift / dimensions.w);
      const wy = p.y + Math.cos(time * 0.45 + p.seed * 1.3) * (drift / dimensions.h);
      // Apply camera transform: center on cam.x/cam.y with zoom
      const sx = (wx - cam.x) * cam.zoom + 0.5;
      const sy = (wy - cam.y) * cam.zoom + 0.5;
      return {
        x: sx * dimensions.w,
        y: sy * dimensions.h,
      };
    },
    [time, dimensions]
  );

  const selectedRepo = selected ? positioned.find((r) => r.n === selected) : null;

  // Feed the camera the tour target's world position (refs so the rAF loop
  // sees fresh values without re-mounting)
  useEffect(() => {
    if (touring && tourTarget) {
      const star = positioned.find((r) => r.n === tourTarget);
      if (star) {
        tourFocusRef.current = { active: true, x: star.x, y: star.y };
        return;
      }
    }
    tourFocusRef.current = { active: false, x: 0.5, y: 0.5 };
  }, [touring, tourTarget, positioned]);
  const inspectingRepo = inspecting ? positioned.find((r) => r.n === inspecting) : null;
  // Highlight + connection focus: tour uses tourTarget so detail panel (selected) stays closed
  const focus = touring ? tourTarget : selected;
  const searchActive = q.length > 0;

  const activeConns = focus
    ? connections.filter((c) => c.a === focus || c.b === focus)
    : [];
  // During Chronicle, also draw the ordered tour path so every stop has visible
  // constellation lines (many stops only have 0–1 explicit edges).
  const tourChainConns = useMemo(() => {
    if (!touring) return [];
    const out = [];
    for (let i = 0; i < tourStops.length - 1; i++) {
      out.push({ a: tourStops[i].repo, b: tourStops[i + 1].repo, label: "", tourChain: true });
    }
    return out;
  }, [touring, tourStops]);

  const displayConns = useMemo(() => {
    if (!touring) return activeConns;
    const keys = new Set(activeConns.map((c) => [c.a, c.b].sort().join("|")));
    const merged = [...activeConns];
    tourChainConns.forEach((c) => {
      const k = [c.a, c.b].sort().join("|");
      if (!keys.has(k)) {
        keys.add(k);
        merged.push(c);
      }
    });
    return merged;
  }, [touring, activeConns, tourChainConns]);

  const connectedNames = new Set(displayConns.flatMap((c) => [c.a, c.b]));

  // Spring-physics camera — pure ambient idle drift now (selecting a star no
  // longer moves the camera; that's reserved for the Inspect view instead)
  useEffect(() => {
    const velRef = { x: 0, y: 0, zoom: 0 };
    let localT = 0;
    let frame;
    const step = () => {
      localT += 0.006;

      const tf = tourFocusRef.current;
      if (tf.active) {
        // Chronicle: glide the camera onto the current stop and zoom in.
        // Mobile zooms harder so constellation lines are legible; the star
        // sits slightly below center to clear the caption at the top.
        const zoom = isMobileRef.current ? 1.9 : 1.45;
        targetRef.current = {
          x: tf.x + Math.sin(localT * 0.3) * 0.004,
          y: tf.y - 0.055 / zoom + Math.cos(localT * 0.24) * 0.003,
          zoom,
        };
      } else {
        targetRef.current = {
          x: 0.5 + Math.sin(localT * 0.12) * 0.025,
          y: 0.5 + Math.cos(localT * 0.09) * 0.02,
          zoom: 1 + Math.sin(localT * 0.05) * 0.02,
        };
      }

      const cur = cameraRef.current;
      const tgt = targetRef.current;
      // Stiffer spring during the tour so the camera lands well within each
      // 4.4s stop; soft ambient drift otherwise
      const stiffness = tf.active ? 0.03 : 0.012;
      const damping = 0.86;

      velRef.x = velRef.x * damping + (tgt.x - cur.x) * stiffness;
      velRef.y = velRef.y * damping + (tgt.y - cur.y) * stiffness;
      velRef.zoom = velRef.zoom * damping + (tgt.zoom - cur.zoom) * stiffness;

      cameraRef.current = {
        x: cur.x + velRef.x,
        y: cur.y + velRef.y,
        zoom: cur.zoom + velRef.zoom,
      };
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Lock body scroll while sky is mounted (fullscreen immersive mode)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "Escape") {
        e.preventDefault();
        if (inField) e.target.blur();
        setInspecting(null);
        setSelected(null);
        setTouring(false);
        setTourTarget(null);
        setQuery("");
      } else if (e.key === "/" && !inField) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        setTourTarget(null);
      }}
      onMouseMove={(e) => {
        if (cursorGlowRef.current) {
          cursorGlowRef.current.style.left = `${e.clientX}px`;
          cursorGlowRef.current.style.top = `${e.clientY}px`;
          cursorGlowRef.current.style.opacity = "1";
        }
      }}
      onMouseLeave={() => {
        if (cursorGlowRef.current) {
          cursorGlowRef.current.style.opacity = "0";
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "radial-gradient(ellipse at 50% 30%, #0c1929 0%, #060d17 55%, #030810 100%)",
        overflow: "hidden",
        fontFamily: "'Inter','SF Pro Display',-apple-system,sans-serif",
        userSelect: "none",
      }}
    >
      {/* Cursor glow — soft light following the mouse */}
      <div
        ref={cursorGlowRef}
        style={{
          position: "fixed",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(94,234,212,0.06) 0%, rgba(94,234,212,0.02) 30%, transparent 60%)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 4,
          opacity: 0,
          transition: "opacity 0.4s ease",
          left: -1000,
          top: -1000,
          mixBlendMode: "screen",
        }}
      />
      {/* Back link */}
      <a
        href="/"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 22,
          left: 16,
          zIndex: 25,
          fontSize: isMobile ? 12 : 11,
          color: "rgba(94,234,212,0.4)",
          textDecoration: "none",
          letterSpacing: 0.5,
          transition: "color 0.2s",
          maxWidth: isMobile ? 72 : "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(94,234,212,0.85)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(94,234,212,0.4)")}
      >
        {isMobile ? "← Home" : "← The Build Report"}
      </a>

      {/* Title + search/tour */}
      <div
        style={{
          position: "absolute",
          top: 22,
          left: isMobile ? 78 : 0,
          right: isMobile ? 96 : 0,
          textAlign: "center",
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        {!touring && (
          <div style={{ fontSize: 10, letterSpacing: isMobile ? 2 : 5, color: "rgba(94,234,212,0.5)", textTransform: "uppercase", marginBottom: 5, fontWeight: 500 }}>
            The CLAWD Ecosystem
          </div>
        )}
        <div style={{
          fontSize: isMobile ? (touring ? 14 : 16) : 24,
          fontWeight: 200,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: isMobile ? 0.5 : 1.5,
          lineHeight: 1.25,
        }}>
          {touring && isMobile
            ? "Chronicle"
            : `${repos.length} Repos, One Autonomous Builder`}
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
                  fontSize: isMobile ? 12 : 15,
                  color: "rgba(240, 220, 180, 0.85)",
                  letterSpacing: 0.3,
                  textAlign: "center",
                  maxWidth: isMobile ? "100%" : 480,
                  padding: isMobile ? "0 4px" : "0 20px",
                  minHeight: 22,
                  textShadow: "0 0 12px rgba(0,0,0,0.7)",
                }}
              >
                {tourStops[tourIndex]?.caption || ""}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {tourStops.map((_, i) => (
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
              ref={searchInputRef}
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

      {/* Ambient music — on by default, loops; toggle to mute */}
      <iframe
        ref={ytIframeRef}
        title="Night Sky ambient music"
        src={`https://www.youtube.com/embed/${SKY_MUSIC_VIDEO_ID}?enablejsapi=1&autoplay=1&loop=1&playlist=${SKY_MUSIC_VIDEO_ID}&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3`}
        allow="autoplay; encrypted-media"
        tabIndex={-1}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          left: -9999,
          top: 0,
          border: 0,
        }}
      />

      {/* Sound + Chronicle — flex row so labels never overlap */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          zIndex: 25,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={toggleMusic}
          aria-pressed={musicOn}
          title={musicOn ? "Mute ambient music" : "Play ambient music"}
          style={{
            fontSize: isMobile ? 10 : 11,
            letterSpacing: 1.5,
            color: musicOn ? "rgba(94,234,212,0.9)" : "rgba(255,255,255,0.45)",
            background: musicOn ? "rgba(94,234,212,0.08)" : "rgba(255,255,255,0.04)",
            border: musicOn ? "1px solid rgba(94,234,212,0.35)" : "1px solid rgba(255,255,255,0.15)",
            padding: isMobile ? "6px 12px" : "7px 14px",
            borderRadius: 20,
            cursor: "pointer",
            textTransform: "uppercase",
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
          }}
        >
          {musicOn ? "Sound on" : "Sound off"}
        </button>

        {!touring && !selected && (
          <button
            onClick={(e) => { e.stopPropagation(); startTour(); }}
            style={{
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
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(240, 220, 180, 0.1)"; e.currentTarget.style.color = "rgba(240, 220, 180, 0.95)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(240, 220, 180, 0.04)"; e.currentTarget.style.color = "rgba(240, 220, 180, 0.7)"; }}
          >
            ▸ Chronicle
          </button>
        )}
      </div>

      {/* Nebula glow */}
      <div style={{ position: "absolute", top: "15%", left: "15%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(94,234,212,0.035) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "12%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.035) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />

      {/* Background stars */}
      {/* Background stars — 3 parallax layers for depth */}
      <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
        {(() => {
          const cam = cameraRef.current;
          const layers = [
            { count: 150, parallax: 0.15, rMin: 0.3, rMax: 0.7, opMin: 0.1, opMax: 0.35, seed: 100 },
            { count: 80,  parallax: 0.4,  rMin: 0.6, rMax: 1.2, opMin: 0.2, opMax: 0.5,  seed: 300 },
            { count: 35,  parallax: 0.75, rMin: 1.1, rMax: 1.9, opMin: 0.3, opMax: 0.6,  seed: 700 },
          ];
          const out = [];
          layers.forEach((layer, li) => {
            const effCX = 0.5 + (cam.x - 0.5) * layer.parallax;
            const effCY = 0.5 + (cam.y - 0.5) * layer.parallax;
            const effZ = 1 + (cam.zoom - 1) * layer.parallax;
            for (let i = 0; i < layer.count; i++) {
              const wx = rand(layer.seed + i * 3.1);
              const wy = rand(layer.seed + i * 5.7);
              const sx = (wx - effCX) * effZ + 0.5;
              const sy = (wy - effCY) * effZ + 0.5;
              if (sx < -0.05 || sx > 1.05 || sy < -0.05 || sy > 1.05) continue;
              const r = layer.rMin + rand(layer.seed + i * 1.9) * (layer.rMax - layer.rMin);
              const baseOp = layer.opMin + rand(layer.seed + i * 2.3) * (layer.opMax - layer.opMin);
              const twinkle = 0.55 + 0.45 * Math.sin(time * (1.5 + li * 0.4) + i);
              out.push(
                <circle
                  key={`${li}-${i}`}
                  cx={`${sx * 100}%`}
                  cy={`${sy * 100}%`}
                  r={r * (0.9 + effZ * 0.1)}
                  fill="white"
                  opacity={baseOp * twinkle}
                />
              );
            }
          });
          return out;
        })()}
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
      {focus && displayConns.length > 0 && (
        <svg width={dimensions.w} height={dimensions.h}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 8 }}>
          <defs>
            <filter id="conn-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {displayConns.map((conn, i) => {
            const rA = positioned.find((p) => p.n === conn.a);
            const rB = positioned.find((p) => p.n === conn.b);
            if (!rA || !rB) return null;
            const posA = getPos(rA);
            const posB = getPos(rB);
            const meta = CAT_META[rA.n === focus ? rA.c : rB.c] || CAT_META.misc;
            const midX = (posA.x + posB.x) / 2;
            const midY = (posA.y + posB.y) / 2;
            const isChain = !!conn.tourChain;
            const touchesFocus = conn.a === focus || conn.b === focus;
            // Match category colors — no cream/white tour strokes
            const stroke = meta.core;
            const width = isChain
              ? (touchesFocus ? 2.2 : 1.2)
              : (touring ? 1.8 : 1.2);
            const opacity = isChain
              ? (touchesFocus ? 0.9 : 0.18)
              : (touring ? 0.75 : 0.45);
            return (
              <g key={`${conn.a}|${conn.b}|${i}`}>
                <line x1={posA.x} y1={posA.y} x2={posB.x} y2={posB.y}
                  stroke={stroke} strokeWidth={width} opacity={opacity} filter="url(#conn-glow)" />
                {touchesFocus && [0, 0.33, 0.66].map((offset) => {
                  const speed = 0.35;
                  const t = ((time * speed + offset + i * 0.17) % 1);
                  const goingFromSel = conn.a === focus;
                  const from = goingFromSel ? posA : posB;
                  const to = goingFromSel ? posB : posA;
                  const px = from.x + (to.x - from.x) * t;
                  const py = from.y + (to.y - from.y) * t;
                  const op = Math.sin(t * Math.PI) * 0.85;
                  return (
                    <circle
                      key={`p-${offset}`}
                      cx={px}
                      cy={py}
                      r={touring ? 2.2 : 1.6}
                      fill={meta.core}
                      opacity={op}
                      filter="url(#conn-glow)"
                    />
                  );
                })}
                {/* Edge labels: desktop only, and only for the focused star — never during
                    mobile tour (family edges like "slop.computer" stack into illegible piles). */}
                {!isMobile && !isChain && touchesFocus && !!conn.label && (
                  <text x={midX} y={midY - 8} fill={meta.core} fontSize={8.5}
                    textAnchor="middle" opacity={0.65} fontFamily="inherit"
                    style={{ paintOrder: "stroke", stroke: "rgba(3,8,16,0.85)", strokeWidth: 3 }}>
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
        const isSel = focus === r.n;
        const isHovered = hoveredStar === r.n;
        const isConnected = connectedNames.has(r.n);
        const catHighlighted = hoveredCat === r.c;
        const searchMatch = matchesQuery(r);
        const dimmed =
          (searchActive && !searchMatch) ||
          (!searchActive && hoveredCat && !catHighlighted) ||
          (focus && !isSel && !isConnected);
        const dimOpacity = touring ? 0.38 : 0.12;

        const score = sizeScore(r);
        const zoom = cameraRef.current.zoom;
        // 75% stars / 25% forks — soft range, hard-capped
        const baseSize = Math.min(18, 5 + score * 14);
        // Search matches get subtly larger to stand out more
        const searchBoost = searchActive && searchMatch ? 1.25 : 1;
        const size = baseSize * (isSel ? 1.6 : 1) * (0.85 + zoom * 0.15) * searchBoost;
        // Search matches pulse more strongly to feel alive
        const pulseAmp = searchActive && searchMatch ? 0.25 : 0.12;
        const pulse = 1 + Math.sin(time * 2.2 + r.seed * 6) * pulseAmp;

        // Brightness scales with the same score
        const glowIntensity = Math.min(1, 0.35 + score * 0.55);
        const isMajor = score >= 0.45; // top tier — gets a persistent name label

        // Diffraction spikes for bright stars (real astronomy: bright stars have visible spikes)
        const spikeMode = score >= 0.7 ? 8 : score >= 0.45 ? 4 : 0;
        const spikeAngles = spikeMode === 8 ? [0, 45, 90, 135] : spikeMode === 4 ? [0, 90] : [];
        const spikeLength = size * (spikeMode === 8 ? 5 : 4) * pulse;

        return (
          <div
            key={r.n}
            onClick={(e) => {
              e.stopPropagation();
              if (touring) {
                setTouring(false);
                setTourTarget(null);
              }
              setSelected(selected === r.n ? null : r.n);
            }}
            onDoubleClick={(e) => { e.stopPropagation(); setInspecting(r.n); }}
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
              opacity: dimmed ? dimOpacity : 1,
              transition: "opacity 0.3s ease",
            }}
          >
            {/* Sonar pulse rings for selected star (expanding outward, fading) */}
            {isSel && [0, 1, 2].map((ringI) => {
              const ringCycle = 2.8;
              const ringPhase = ((time + ringI * 0.93) % ringCycle) / ringCycle;
              const ringScale = 1.5 + ringPhase * 8;
              const ringOpacity = (1 - ringPhase) * 0.7 * Math.sin(ringPhase * Math.PI);
              return (
                <div
                  key={`ring-${ringI}`}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: size * ringScale,
                    height: size * ringScale,
                    borderRadius: "50%",
                    border: `1px solid ${meta.core}`,
                    transform: "translate(-50%, -50%)",
                    opacity: ringOpacity,
                    pointerEvents: "none",
                    boxShadow: `0 0 8px ${meta.glow}`,
                  }}
                />
              );
            })}
            {/* Diffraction spikes (bright stars only) */}
            {spikeAngles.map((angle) => (
              <div
                key={angle}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: spikeLength,
                  height: 0.8,
                  background: `linear-gradient(to right, transparent 0%, ${meta.core}00 15%, ${meta.core}CC 50%, ${meta.core}00 85%, transparent 100%)`,
                  transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                  opacity: isSel ? 0.9 : 0.55,
                  pointerEvents: "none",
                }}
              />
            ))}
            {/* Outer glow — brighter for high-activity repos */}
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: size * (isSel ? 3 : 2.2) * pulse, height: size * (isSel ? 3 : 2.2) * pulse,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${meta.glow} 0%, transparent 70%)`,
              opacity: isSel ? 0.9 : glowIntensity,
            }} />
            {/* Core — bright box-shadow scales with activity, not just size */}
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: size * 0.55, height: size * 0.55, borderRadius: "50%",
              background: meta.core,
              boxShadow: `0 0 ${size * 0.6 * (0.6 + glowIntensity * 0.6)}px ${meta.glow}`,
            }} />
            {/* Persistent label for major repos — skip during Chronicle (clutter) */}
            {isMajor && !isHovered && !isSel && !dimmed && !touring && (
              <div style={{
                position: "absolute",
                top: size + 3,
                left: "50%",
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                fontSize: 9,
                fontWeight: 500,
                color: meta.core,
                opacity: 0.55,
                textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                pointerEvents: "none",
                letterSpacing: 0.2,
              }}>
                {r.n}
              </div>
            )}
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

      {/* Detail panel — only for manual taps (selected). Chronicle uses tourTarget instead. */}
      {selectedRepo && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={isMobile ? {
            position: "absolute",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(6,13,23,0.94)",
            border: `1px solid ${CAT_META[selectedRepo.c].core}33`,
            borderRadius: 12,
            padding: "14px 16px",
            maxWidth: 440,
            width: "calc(100% - 48px)",
            zIndex: 40,
            backdropFilter: "blur(20px)",
            maxHeight: "40vh",
            overflowY: "auto",
          } : {
            position: "absolute",
            top: 100,
            bottom: 100,
            right: 20,
            width: 320,
            background: "rgba(6,13,23,0.94)",
            border: `1px solid ${CAT_META[selectedRepo.c].core}33`,
            borderRadius: 12,
            padding: "18px 20px",
            zIndex: 40,
            backdropFilter: "blur(20px)",
            overflowY: "auto",
            animation: "panelSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {!isMobile && (
            <style>{`
              @keyframes panelSlideIn {
                from { transform: translateX(20px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}</style>
          )}
          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); setSelected(null); }}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, paddingRight: isMobile ? 0 : 26, flexWrap: isMobile ? "nowrap" : "wrap" }}>
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
              letterSpacing: 1.5, opacity: 0.75, marginLeft: isMobile ? "auto" : 0, whiteSpace: "nowrap", flexShrink: 0,
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
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
              <button
                onClick={() => setInspecting(selectedRepo.n)}
                title="Zoom in for a close-up"
                style={{
                  fontSize: 11,
                  color: "#030810",
                  background: CAT_META[selectedRepo.c].core,
                  border: "none",
                  padding: "3px 12px",
                  borderRadius: 20,
                  cursor: "pointer",
                  fontWeight: 600,
                  boxShadow: `0 0 10px ${CAT_META[selectedRepo.c].glow}`,
                }}
              >
                ◎ inspect
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}#${selectedRepo.n}`;
                  navigator.clipboard?.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                title="Copy link to this star"
                style={{
                  fontSize: 11,
                  color: copied ? CAT_META[selectedRepo.c].core : "rgba(255,255,255,0.5)",
                  background: "transparent",
                  border: `1px solid ${copied ? CAT_META[selectedRepo.c].core + "88" : "rgba(255,255,255,0.15)"}`,
                  padding: "3px 10px",
                  borderRadius: 20,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "✓ copied" : "copy link"}
              </button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`look at ${selectedRepo.n} in the CLAWD ecosystem sky`)}&url=${encodeURIComponent(typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#${selectedRepo.n}` : "")}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Share on X"
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  padding: "3px 10px",
                  borderRadius: 20,
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                share
              </a>
              <a
                href={selectedRepo.u}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11, color: CAT_META[selectedRepo.c].core,
                  textDecoration: "none", border: `1px solid ${CAT_META[selectedRepo.c].core}44`,
                  padding: "3px 10px", borderRadius: 20,
                }}
              >
                GitHub →
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
      {isMobile && !selected && !touring && (
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
      {!touring && ((!isMobile) || legendOpen) && (
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

      {/* Category description tooltip (floats left of legend on hover) */}
      {hoveredCat && !isMobile && !selected && CAT_DESCRIPTIONS[hoveredCat] && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 200,
            maxWidth: 260,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(6,13,23,0.92)",
            border: `1px solid ${CAT_META[hoveredCat].core}33`,
            backdropFilter: "blur(12px)",
            zIndex: 22,
            pointerEvents: "none",
            fontSize: 11,
            color: "rgba(255,255,255,0.75)",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            lineHeight: 1.45,
            textAlign: "right",
          }}
        >
          {CAT_DESCRIPTIONS[hoveredCat]}
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
          tap a star · double-tap to inspect · press / to search
        </div>
      )}
      {touring && (
        <div style={{
          position: "absolute", bottom: 24, fontSize: 10.5,
          color: "rgba(240, 220, 180, 0.4)", letterSpacing: 0.5, pointerEvents: "none",
          fontStyle: "italic", fontFamily: "Georgia, 'Times New Roman', serif",
          ...(isMobile
            ? { left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }
            : { left: 24 }),
        }}>
          tap anywhere to stop
        </div>
      )}

      {/* ═══ INSPECT VIEW — the awe-inspiring close-up ═══ */}
      {inspectingRepo && (
        <div
          onClick={() => setInspecting(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "radial-gradient(ellipse at 50% 45%, #050a12 0%, #01030a 70%)",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: isMobile ? 24 : 64,
            padding: isMobile ? "24px 20px" : "40px",
            animation: "inspectFadeIn 0.5s ease",
            overflowY: "auto",
          }}
        >
          <style>{`
            @keyframes inspectFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes sphereRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes sphereRiseIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes textRiseIn { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          `}</style>

          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); setInspecting(null); }}
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              zIndex: 210,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)",
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>

          {/* Far background starfield for depth */}
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {Array.from({ length: 60 }, (_, i) => (
              <circle
                key={i}
                cx={`${rand(i * 9.1) * 100}%`}
                cy={`${rand(i * 7.3) * 100}%`}
                r={rand(i * 4.1) * 1.2 + 0.2}
                fill="white"
                opacity={(rand(i * 3.7) * 0.35 + 0.08) * (0.6 + 0.4 * Math.sin(time * 1.5 + i))}
              />
            ))}
          </svg>

          {/* The sphere */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: isMobile ? 220 : 340,
              height: isMobile ? 220 : 340,
              flexShrink: 0,
              animation: "sphereRiseIn 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Atmospheric glow */}
            <div style={{
              position: "absolute",
              inset: -60,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${CAT_META[inspectingRepo.c].glow} 0%, transparent 65%)`,
              filter: "blur(20px)",
              opacity: 0.9,
            }} />
            {/* Diffraction spikes, huge */}
            {[0, 45, 90, 135].map((angle) => (
              <div
                key={angle}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: isMobile ? 340 : 560,
                  height: 1.5,
                  background: `linear-gradient(to right, transparent 0%, ${CAT_META[inspectingRepo.c].core}00 10%, ${CAT_META[inspectingRepo.c].core}99 50%, ${CAT_META[inspectingRepo.c].core}00 90%, transparent 100%)`,
                  transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                  opacity: 0.5,
                }}
              />
            ))}
            {/* Sphere body — masked circle containing rotating texture */}
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              overflow: "hidden",
              boxShadow: `0 0 60px 10px ${CAT_META[inspectingRepo.c].glow}, inset -30px -30px 60px rgba(0,0,0,0.7)`,
            }}>
              {/* Rotating textured layer */}
              <div style={{
                position: "absolute",
                top: "-25%",
                left: "-25%",
                width: "150%",
                height: "150%",
                background: `${generateSphereTexture(inspectingRepo.n, CAT_META[inspectingRepo.c].core, CAT_META[inspectingRepo.c].glow)}, radial-gradient(circle, ${CAT_META[inspectingRepo.c].core}55 0%, #05080f 75%)`,
                animation: "sphereRotate 90s linear infinite",
              }} />
              {/* Lighting overlay: highlight top-left, shadow bottom-right */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.5) 0%, transparent 35%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.6) 0%, transparent 55%)`,
              }} />
            </div>
            {/* Sonar rings */}
            {[0, 1, 2].map((ringI) => {
              const ringCycle = 3.2;
              const ringPhase = ((time + ringI * 1.05) % ringCycle) / ringCycle;
              const ringScale = 1 + ringPhase * 0.5;
              const ringOpacity = (1 - ringPhase) * 0.5 * Math.sin(ringPhase * Math.PI);
              return (
                <div key={ringI} style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  border: `1px solid ${CAT_META[inspectingRepo.c].core}`,
                  transform: `scale(${ringScale})`,
                  opacity: ringOpacity,
                  pointerEvents: "none",
                }} />
              );
            })}
          </div>

          {/* Info panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: isMobile ? "100%" : 440,
              textAlign: isMobile ? "center" : "left",
              animation: "textRiseIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both",
            }}
          >
            <div style={{
              fontSize: 11, letterSpacing: 4, textTransform: "uppercase",
              color: CAT_META[inspectingRepo.c].core, opacity: 0.8, marginBottom: 10,
              fontWeight: 500,
            }}>
              {CAT_META[inspectingRepo.c].label} · {inspectingRepo.catRank} of {inspectingRepo.catTotal}
            </div>
            <div style={{
              fontSize: isMobile ? 32 : 46, fontWeight: 800, color: "white",
              letterSpacing: -0.5, lineHeight: 1.05, marginBottom: 14,
              wordBreak: "break-word",
            }}>
              {inspectingRepo.n}
            </div>
            <div style={{
              fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6,
              marginBottom: 22, fontStyle: inspectingRepo.d ? "normal" : "italic",
            }}>
              {inspectingRepo.d || "No description yet — clawdbotatg hasn't written one."}
            </div>

            <div style={{
              display: "flex", gap: 24, marginBottom: 22,
              justifyContent: isMobile ? "center" : "flex-start",
            }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "white" }}>{inspectingRepo.s}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" }}>stars</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "white" }}>{inspectingRepo.f}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" }}>forks</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "white" }}>{inspectingRepo.l || "—"}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase" }}>language</div>
              </div>
            </div>

            {/* Connections */}
            {(() => {
              const conns = connections.filter((c) => c.a === inspectingRepo.n || c.b === inspectingRepo.n);
              if (conns.length === 0) return null;
              return (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                    Connected to
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: isMobile ? "center" : "flex-start" }}>
                    {conns.map((conn, i) => {
                      const other = conn.a === inspectingRepo.n ? conn.b : conn.a;
                      return (
                        <div
                          key={i}
                          onClick={() => setInspecting(other)}
                          style={{
                            fontSize: 10.5, padding: "4px 11px", borderRadius: 16,
                            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                            color: "rgba(255,255,255,0.6)", cursor: "pointer",
                          }}
                        >
                          {other}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 10, justifyContent: isMobile ? "center" : "flex-start" }}>
              <a
                href={inspectingRepo.u}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12.5, color: "#030810", background: CAT_META[inspectingRepo.c].core,
                  textDecoration: "none", padding: "8px 18px", borderRadius: 20, fontWeight: 600,
                  boxShadow: `0 0 16px ${CAT_META[inspectingRepo.c].glow}`,
                }}
              >
                View on GitHub →
              </a>
              <button
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}#${inspectingRepo.n}`;
                  navigator.clipboard?.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                style={{
                  fontSize: 12.5, color: "rgba(255,255,255,0.6)", background: "transparent",
                  border: "1px solid rgba(255,255,255,0.2)", padding: "8px 18px",
                  borderRadius: 20, cursor: "pointer",
                }}
              >
                {copied ? "✓ copied" : "copy link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
