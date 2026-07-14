// app/api/ecosystem-repos/route.js
// Fetches all clawdbotatg repos, filters, categorizes, caches 1hr on Vercel

export const revalidate = 3600;

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

function categorize(name, description, language) {
  const text = `${name} ${description || ""}`.toLowerCase();
  const lang = (language || "").toLowerCase();

  if (
    [
      "token",
      "vesting",
      "burn",
      "stake",
      "staking",
      "fomo",
      "bounty",
      "auction",
      " market",
      "pfp-market",
      "trading",
      "swap",
      "liquidity",
      "treasury",
      "viction",
      "clawdgate",
      "dca ",
      "portfolio",
    ].some((k) => text.includes(k))
  )
    return "token-econ";

  if (
    lang === "solidity" ||
    [
      "contract",
      "erc-8004",
      "erc8004",
      "onchain",
      "dapp",
      "escrow",
      "ethereum",
    ].some((k) => text.includes(k))
  )
    return "onchain";

  if (
    [
      "agent",
      "harness",
      "sandbox",
      "container",
      "gateway",
      "openclaw",
      "skill",
      "orchestrat",
      "spawn",
      "larvae",
      "claude code",
      "claude-code",
    ].some((k) => text.includes(k))
  )
    return "agent-infra";

  if (
    [
      "video",
      "clip",
      "podcast",
      "episode",
      "slop.computer",
      "slop-computer",
      "slop_computer",
      "audio",
      "music",
      "stream",
      "tweet",
      "twitter",
      " x.com",
      "rtmp",
      "obs",
    ].some((k) => text.includes(k))
  )
    return "media";

  if (
    [
      "dashboard",
      "score",
      "scoring",
      "report",
      "review",
      "grade",
      "metric",
      "analytic",
      "meter",
      "accountability",
      "audit",
    ].some((k) => text.includes(k))
  )
    return "governance";

  if (
    ["ios", "swift", "on-device", "on device", "camera", "photo", "mobile", "app store"].some(
      (k) => text.includes(k)
    ) ||
    lang === "swift"
  )
    return "mobile";

  if (["game", "play", "3d", "idle", "clicker", "puzzle", "punks"].some((k) => text.includes(k)))
    return "games";

  if (
    [
      "calendar",
      "chat",
      "tool",
      "extension",
      "cli",
      "sdk",
      " api",
      "library",
      "utils",
      "plugin",
      "browser",
      "scheduler",
      "scribe",
      "notes",
      "landing",
      "quill",
      "hermes",
    ].some((k) => text.includes(k))
  )
    return "devtools";

  if (
    ["community", "hub", "directory", "badge", "achievement", "gate"].some((k) =>
      text.includes(k)
    )
  )
    return "community";

  if (
    [
      "research",
      "zk",
      "llm",
      "model",
      "experiment",
      "lab",
      "idea",
      "exploration",
      "voting",
      "ballot",
    ].some((k) => text.includes(k))
  )
    return "research";

  return "misc";
}

async function fetchAllRepos() {
  const allRepos = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.github.com/users/clawdbotatg/repos?per_page=100&page=${page}&sort=updated`,
      { headers: GITHUB_HEADERS, next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      console.error(`GitHub API error: ${res.status} on page ${page}`);
      break;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    allRepos.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return allRepos;
}

export async function GET() {
  try {
    const raw = await fetchAllRepos();

    // Homepage owns the GITHUB_TOKEN budget for live commit scans / scores.
    // Do NOT add per-repo /commits fetches here.
    const repos = raw
      .filter((r) => !r.fork)
      .filter((r) => !r.name.startsWith("leftclaw-service-job"))
      .filter((r) => r.name !== "vaultid")
      .map((r) => ({
        n: r.name,
        d: r.description || "",
        l: r.language || "",
        s: r.stargazers_count,
        f: r.forks_count,
        c: categorize(r.name, r.description, r.language),
        u: r.html_url,
      }));

    return Response.json({
      repos,
      generatedAt: new Date().toISOString(),
      total: repos.length,
    });
  } catch (err) {
    console.error("ecosystem-repos error:", err);
    return Response.json(
      { error: "Failed to fetch repos", repos: [], generatedAt: null },
      { status: 500 }
    );
  }
}
