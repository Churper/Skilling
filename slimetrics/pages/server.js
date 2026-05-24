/* Server Overall — top-level dashboard for live + cumulative server health.
   Reads from slimetrics_server_* RPCs. All numeric ts fields are epoch
   SECONDS, so multiply by 1000 before passing to timeAgo / Date. */

import { escapeHtml } from "../lib/nav.js";
import { api } from "../lib/api.js";
import { nf, nfShort, timeAgo } from "../lib/format.js";

export async function renderServer($page, params = {}) {
  const period = (params.period === "7d" || params.period === "30d") ? params.period : "24h";
  $page.innerHTML = `<div class="st-loading">Loading server stats…</div>`;
  try {
    const [overview, chart, heatmap, bosses, islands, welcome, signups] = await Promise.all([
      api.serverOverview(),
      api.serverChart(period),
      api.serverHeatmap(),
      api.recentBosses(12),
      api.recentIslands(12),
      api.welcomeBanner(5),
      api.signupChart(),
    ]);
    paint($page, { overview, chart, heatmap, bosses, islands, welcome, signups, period });
  } catch (e) {
    $page.innerHTML = `<div class="st-error">Failed to load server stats: ${escapeHtml(e.message || e)}</div>`;
  }
}

function paint($page, { overview, chart, heatmap, bosses, islands, welcome, signups, period }) {
  const o = overview || {};
  $page.innerHTML = `
    <div class="srv-shell">
      <div class="section-head">
        <h1 class="section-title">Server Overall</h1>
        <div class="eyebrow"><span class="pulse"></span> live</div>
      </div>

      ${newSlimesStrip(welcome)}

      <div class="srv-stat-grid" style="margin-top:18px">
        ${statCard("Online Now", nf(o.online_now), `peak today ${nf(o.peak_today)} · all-time ${nf(o.peak_alltime)}`, "var(--slime)", "", "is-live")}
        ${statCard("Total Slimes", nf(o.total_accounts), `${nf(o.signups_today || 0)} joined today`, "#b692ff", sparkline(signups))}
        ${statCard("Sapling vs Legacy", nf((o.saplings || 0) + (o.legacy || 0)), "all registered slimes", "#5ee7e0", saplingsBar(o))}
      </div>

      <div class="srv-stat-grid" style="margin-top:14px">
        ${flexCard("🌱 Top Sapling Today", o.top_grinder ? escapeHtml(o.top_grinder.name) : "—", o.top_grinder ? `+${nfShort(o.top_grinder.xp_gained || 0)} XP today` : "no data yet", "#ff6b9d")}
        ${flexCard("🎯 Skill of the Day", o.skill_of_day ? prettySkill(o.skill_of_day.skill) : "—", o.skill_of_day ? `+${nfShort(o.skill_of_day.xp || 0)} XP today` : "no data yet", "#79c7ff")}
        ${flexCard("⚔️ Boss of the Day", o.boss_of_day ? prettyBoss(o.boss_of_day.boss) : "—", o.boss_of_day ? `${nf(o.boss_of_day.count || 0)} kills today` : "no kills yet", "#ff5e8a")}
      </div>

      <div class="srv-stat-grid" style="margin-top:14px">
        ${statCard("XP Today", nfShort(o.xp_today), "across all slimes", "var(--slime)")}
        ${statCard("Levels Up Today", nf(o.levels_today), "summed gains", "#7dffc1")}
        ${statCard("Bosses Killed Today", nf(o.bosses_today), `${nf(bosses?.length || 0)} in ticker`, "#ff6b9d")}
        ${statCard("Islands Charted Today", nf(o.islands_today), "first-time discoveries", "#79c7ff")}
      </div>

      <div class="srv-stat-grid" style="margin-top:14px">
        ${flexCard("💀 Bosses Slain (all-time)", nf(o.total_bosses_alltime || 0), "since tracking began", "#b692ff")}
        ${flexCard("🗺️ Islands Charted (all-time)", nf(o.total_islands_alltime || 0), "across all slimes", "#5ee7e0")}
      </div>

      <div class="st-card" style="margin-top:14px">
        <div class="st-card-head">
          <div class="st-card-title">Online Over Time</div>
          <div class="srv-period">
            ${periodBtn("24h", period)} ${periodBtn("7d", period)} ${periodBtn("30d", period)}
          </div>
        </div>
        <div id="srv-chart">${renderOnlineChart(chart, period)}</div>
      </div>

      <div class="grid-2" style="margin-top:14px">
        <div class="st-card">
          <div class="st-card-head">
            <div class="st-card-title">Recent Boss Kills</div>
            <div class="eyebrow">last 24h</div>
          </div>
          ${renderBossList(bosses)}
        </div>
        <div class="st-card">
          <div class="st-card-head">
            <div class="st-card-title">Recent Islands Charted</div>
            <div class="eyebrow">last 7d</div>
          </div>
          ${renderIslandList(islands)}
        </div>
      </div>

      <div class="st-card" style="margin-top:14px">
        <div class="st-card-head">
          <div class="st-card-title">Activity Heatmap</div>
          <div class="eyebrow">avg online · last 14d · UTC</div>
        </div>
        <div class="srv-heatmap-scroll">
          ${renderHeatmap(heatmap)}
        </div>
      </div>
    </div>

    <style>
      /* Local aliases — slimetrics uses --bg-elev1/--line/--fg-dim, our
         design used --card/--border/--muted. Map them so the design
         tokens resolve correctly without fighting the global CSS. */
      .srv-shell {
        --srv-card: var(--bg-elev1);
        --srv-card-2: var(--bg-elev2);
        --srv-border: var(--line);
        --srv-border-soft: var(--line-soft);
        --srv-muted: var(--fg-dim);
        --srv-muted-strong: rgba(232,236,242,0.78);
        --gap-md: 12px;
        --gap-lg: 18px;
        --r-md: 14px;
        max-width: 1120px;
        margin: 0 auto;
        padding: 0 24px 64px;
        font-size: 15px; line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      @media (max-width: 720px) { .srv-shell { padding: 0 16px 64px; } }

      .srv-shell .section-head {
        display: flex; align-items: baseline; justify-content: space-between;
        gap: var(--gap-md); padding-bottom: 6px;
        border-bottom: 1px solid var(--srv-border-soft);
      }
      .srv-shell .section-title {
        font-family: var(--font, var(--ui-font-heading));
        margin: 0; line-height: 1.05; letter-spacing: 0.01em;
        font-size: clamp(22px, 3vw, 30px);
        color: var(--fg); font-weight: 700;
        text-transform: uppercase;
      }
      .srv-shell .eyebrow {
        font-size: 11px; color: var(--srv-muted);
        text-transform: uppercase; letter-spacing: 0.12em; white-space: nowrap;
      }
      .srv-shell .pulse {
        display: inline-block; width: 7px; height: 7px; border-radius: 50%;
        background: var(--slime); margin-right: 8px; box-shadow: 0 0 10px var(--slime);
        animation: srv-pulse 1.8s ease-in-out infinite; vertical-align: middle;
      }
      @keyframes srv-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

      /* Stat grid + cards */
      .srv-stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--gap-md);
      }
      @media (max-width: 480px) {
        .srv-stat-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
      }
      .srv-stat {
        background: var(--srv-card); border: 1px solid var(--srv-border);
        border-radius: var(--r-md); padding: 14px 16px;
        position: relative; overflow: hidden;
        display: flex; flex-direction: column;
        min-height: 124px;
        transition: border-color 160ms, transform 160ms;
      }
      .srv-stat:hover { border-color: rgba(255,255,255,0.14); }
      .srv-stat::before {
        content: ""; position: absolute; left: 0; top: 12px; bottom: 12px;
        width: 3px; border-radius: 0 3px 3px 0; background: var(--accent);
      }
      .srv-stat.is-live {
        background:
          linear-gradient(180deg, rgba(80,232,120,0.10), rgba(80,232,120,0.03)),
          var(--srv-card);
        border-color: rgba(80,232,120,0.45);
        box-shadow: inset 0 0 0 1px rgba(80,232,120,0.15);
      }
      .srv-stat.is-live:hover { border-color: rgba(80,232,120,0.7); }
      .srv-stat.is-live::before { background: var(--slime); box-shadow: 0 0 12px rgba(80,232,120,0.55); }
      .srv-stat.is-live .srv-stat-value { color: #d8ffe5; }

      .srv-stat-label {
        font-size: 12px; color: var(--srv-muted-strong);
        text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;
      }
      .srv-stat-value {
        font-size: 32px; font-weight: 800; margin-top: 8px;
        line-height: 1.1; letter-spacing: -0.01em;
        color: var(--accent, var(--fg));
      }
      .srv-stat-sub {
        font-size: 13px; color: var(--srv-muted-strong);
        margin-top: 8px; line-height: 1.45;
      }
      .srv-stat-spark {
        position: static; margin-top: auto; padding-top: 6px;
        width: 100%; height: 18px; opacity: 0.85;
        pointer-events: none; overflow: visible;
      }

      /* Sapling vs Legacy split bar */
      .srv-sapline {
        display: flex; align-items: center; gap: 8px;
        font-size: 11px; color: var(--srv-muted);
        margin-top: auto; padding-top: 6px; flex-wrap: wrap;
      }
      .srv-sap-bar {
        position: relative; display: flex;
        height: 7px; border-radius: 4px; overflow: hidden;
        flex: 1; min-width: 60px; max-width: 100px;
        background: var(--srv-border); cursor: default;
      }
      .srv-sap-seg { height: 100%; transition: filter 140ms; position: relative; }
      .srv-sap-seg.is-sap { background: var(--slime); }
      .srv-sap-seg.is-leg { background: #ffd060; }
      .srv-sap-bar:hover .srv-sap-seg { filter: brightness(1.15); }
      .srv-sap-legend { display: inline-flex; gap: 10px; font-size: 11px; color: var(--srv-muted); }
      .srv-sap-legend-item { display: inline-flex; align-items: center; gap: 6px; transition: color 140ms; }
      .srv-sap-legend-item:hover { color: var(--fg); }
      .srv-sap-legend-dot { width: 8px; height: 8px; border-radius: 50%; }
      .srv-sap-legend-dot.is-sap { background: var(--slime); }
      .srv-sap-legend-dot.is-leg { background: #ffd060; }
      .srv-sap-legend-num { color: var(--fg); font-weight: 700; }

      /* New-slimes strip — thin inline row */
      .srv-newslimes {
        position: relative; margin-top: var(--gap-lg);
        padding: 10px 14px; border-radius: 14px;
        background: rgba(80,232,120,0.06);
        border: 1px solid rgba(120,255,160,0.22);
        display: flex; align-items: center; flex-wrap: wrap;
        gap: 8px 10px; overflow: hidden;
      }
      .srv-newslimes::before {
        content: ""; position: absolute; inset: 0;
        background: radial-gradient(ellipse at left center, rgba(80,232,120,0.10), transparent 55%);
        pointer-events: none;
      }
      .srv-newslimes-eyebrow {
        position: relative; display: inline-flex; align-items: center; gap: 6px;
        font-family: var(--ui-font-heading); font-size: 14px; font-weight: 700;
        letter-spacing: 0.14em; text-transform: uppercase; color: var(--slime);
        white-space: nowrap; flex-shrink: 0;
      }
      .srv-newslimes-eyebrow .leaf { font-size: 14px; }
      .srv-newslimes-chips {
        position: relative; display: flex; flex-wrap: wrap; gap: 6px; min-width: 0;
      }
      .srv-newslimes-chip {
        display: inline-flex; align-items: baseline; gap: 8px;
        padding: 5px 12px; border-radius: 999px;
        background: rgba(80,232,120,0.08);
        border: 1px solid rgba(120,255,160,0.32);
        color: #f0fff5;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        font-size: 13px; font-weight: 600; text-decoration: none;
        transition: background 140ms, border-color 140ms, transform 140ms;
      }
      .srv-newslimes-chip:hover {
        background: rgba(80,232,120,0.16);
        border-color: rgba(120,255,160,0.55);
        transform: translateY(-1px);
      }
      .srv-newslimes-chip-leaf { font-size: 11px; line-height: 1; }
      .srv-newslimes-chip-time {
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 10px; font-weight: 500;
        color: rgba(232,255,238,0.45);
      }

      /* Generic card */
      .srv-shell .st-card {
        background: var(--srv-card); border: 1px solid var(--srv-border);
        border-radius: var(--r-md); padding: 16px 18px 18px;
      }
      @media (max-width: 480px) { .srv-shell .st-card { padding: 14px 14px 16px; } }
      .srv-shell .st-card-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: var(--gap-md); margin-bottom: 12px;
      }
      .srv-shell .st-card-title {
        font-family: var(--ui-font-heading); font-size: 19px; font-weight: 700;
        letter-spacing: 0.01em;
      }
      .srv-shell .grid-2 {
        display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-md);
      }
      @media (max-width: 760px) { .srv-shell .grid-2 { grid-template-columns: 1fr; } }

      /* Period pills */
      .srv-period { display: flex; gap: 4px; }
      .srv-period a {
        padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
        color: var(--srv-muted); text-decoration: none; border: 1px solid var(--srv-border);
        transition: color 140ms, border-color 140ms, background 140ms;
      }
      .srv-period a:hover { color: var(--fg); border-color: rgba(255,255,255,0.18); }
      .srv-period a.is-active {
        background: var(--slime); color: #0d0c1a;
        border-color: var(--slime); font-weight: 700;
      }

      /* Tickers */
      .srv-feed-row {
        display: flex; align-items: center; gap: 14px;
        padding: 12px 2px; border-bottom: 1px solid var(--srv-border-soft);
      }
      .srv-feed-row:first-child { padding-top: 4px; }
      .srv-feed-row:last-child { border-bottom: none; padding-bottom: 4px; }
      .srv-feed-icon {
        font-size: 22px; width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .srv-feed-body { flex: 1; min-width: 0; }
      .srv-feed-line { font-size: 14px; line-height: 1.4; color: var(--srv-muted-strong); }
      .srv-feed-line b { color: var(--fg); font-weight: 700; }
      .srv-feed-line a { color: var(--fg); font-weight: 700; text-decoration: none; }
      .srv-feed-line a:hover { color: var(--slime); }
      .srv-feed-meta { font-size: 12px; color: var(--srv-muted); margin-top: 3px; line-height: 1.35; }
      .srv-feed-key { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; opacity: 0.75; }

      /* Heatmap */
      .srv-heatmap-scroll {
        overflow-x: auto; margin: 0 -4px; padding: 0 4px;
        -webkit-overflow-scrolling: touch;
      }
      .srv-heatmap {
        display: grid;
        grid-template-columns: 44px repeat(24, minmax(18px, 1fr));
        gap: 3px; margin-top: 4px; min-width: 560px;
      }
      .srv-heat-cell {
        aspect-ratio: 1; border-radius: 3px;
        background: var(--srv-border); transition: transform 120ms;
      }
      .srv-heat-cell:hover { transform: scale(1.15); }
      .srv-heat-label {
        color: var(--srv-muted); display: flex; align-items: center; justify-content: flex-end;
        padding-right: 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
      }
      .srv-heat-hours {
        display: grid;
        grid-template-columns: 44px repeat(24, minmax(18px, 1fr));
        gap: 3px; font-size: 10px; color: var(--srv-muted);
        margin-top: 8px; min-width: 560px;
      }
      .srv-heat-hours div { text-align: center; }

      .srv-shell .st-empty {
        color: var(--srv-muted); font-size: 13px;
        padding: 16px 4px; text-align: center;
      }
    </style>
  `;
  $page.querySelectorAll(".srv-period a").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const p = a.dataset.period;
      location.hash = p === "24h" ? "#server" : `#server?period=${p}`;
    });
  });
}

function statCard(label, value, sub, accent, extraHtml = "", cls = "") {
  return `<div class="srv-stat ${cls}" style="--accent:${accent}">
    <div class="srv-stat-label">${escapeHtml(label)}</div>
    <div class="srv-stat-value">${escapeHtml(value)}</div>
    <div class="srv-stat-sub">${sub}</div>
    ${extraHtml}
  </div>`;
}
function flexCard(label, value, sub, accent) {
  return `<div class="srv-stat" style="--accent:${accent}">
    <div class="srv-stat-label">${label}</div>
    <div class="srv-stat-value" style="font-size:22px">${value}</div>
    <div class="srv-stat-sub">${escapeHtml(sub)}</div>
  </div>`;
}

function periodBtn(p, current) {
  return `<a href="#server?period=${p}" data-period="${p}" class="${p === current ? "is-active" : ""}">${p}</a>`;
}

/* Saplings/legacy split bar with two segments (green sap + gold legacy)
   plus a legend with dots and counts. */
function saplingsBar(o) {
  const sap = o.saplings || 0, leg = o.legacy || 0, total = sap + leg;
  if (!total) return "";
  const sapPct = (sap / total) * 100;
  const legPct = 100 - sapPct;
  return `
    <div class="srv-sapline">
      <div class="srv-sap-bar" title="🌱 ${nf(sap)} saplings · ⭐ ${nf(leg)} legacy">
        <div class="srv-sap-seg is-sap" style="width:${sapPct.toFixed(1)}%" title="🌱 ${nf(sap)} saplings"></div>
        <div class="srv-sap-seg is-leg" style="width:${legPct.toFixed(1)}%" title="⭐ ${nf(leg)} legacy"></div>
      </div>
      <span class="srv-sap-legend">
        <span class="srv-sap-legend-item" title="saplings"><span class="srv-sap-legend-dot is-sap"></span><span class="srv-sap-legend-num">${nf(sap)}</span></span>
        <span class="srv-sap-legend-item" title="legacy"><span class="srv-sap-legend-dot is-leg"></span><span class="srv-sap-legend-num">${nf(leg)}</span></span>
      </span>
    </div>`;
}

/* Sparkline as a flex child — full-width, fixed-height, can't clip. */
function sparkline(rows) {
  if (!rows?.length || rows.length < 2) return "";
  const W = 200, H = 22, pad = 1;
  let max = 0;
  for (const r of rows) if (r.count > max) max = r.count;
  if (max <= 0) return "";
  const step = W / (rows.length - 1);
  const pts = rows.map((r, i) => [(i * step), pad + (H - pad * 2) - (r.count / max) * (H - pad * 2)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)},${H} L ${pts[0][0].toFixed(1)},${H} Z`;
  return `<svg class="srv-stat-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="srv-sparkgrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--slime)" stop-opacity="0.35"/>
      <stop offset="1" stop-color="var(--slime)" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#srv-sparkgrad)"/>
    <path d="${line}" fill="none" stroke="var(--slime)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

/* Compact inline new-slimes strip — eyebrow + chips, no big hero. */
function newSlimesStrip(rows) {
  if (!rows?.length) return "";
  const label = rows.length === 1 ? "NEW SLIME TODAY" : "NEW SLIMES TODAY";
  return `<div class="srv-newslimes">
    <span class="srv-newslimes-eyebrow"><span class="leaf">🌱</span>${label}</span>
    <div class="srv-newslimes-chips">${rows.map(r => `
      <a class="srv-newslimes-chip" href="#player?name=${encodeURIComponent(r.name)}">
        <span class="srv-newslimes-chip-leaf" aria-hidden="true">🌱</span>
        <span>${escapeHtml(r.name)}</span>
        <span class="srv-newslimes-chip-time">${timeAgoShort(r.t)}</span>
      </a>`).join("")}</div>
  </div>`;
}
function timeAgoShort(epochSec) {
  if (!epochSec) return "";
  const dt = Date.now() - Number(epochSec) * 1000;
  const m = Math.floor(dt / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}

function renderOnlineChart(rows, period) {
  if (!rows?.length) return `<div class="st-empty">No data yet — chart fills as snapshots accumulate.</div>`;
  /* pad.t bumped 14 → 26 so the "players" axis title sits above the
     top y-tick label instead of overlapping wide numbers like "1,000". */
  const W = 800, H = 252, pad = { l: 48, r: 18, t: 26, b: 36 };
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
  const data = rows.map(r => ({ t: Number(r.t) * 1000, v: Math.max(0, Number(r.online) || 0) }));
  const t0 = data[0].t, t1 = data[data.length - 1].t;
  const vMaxRaw = Math.max(...data.map(d => d.v), 1);
  /* Round vmax up to a friendly tick so y-labels are clean integers */
  const niceMax = (n) => {
    if (n <= 5) return 5;
    if (n <= 10) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(n)));
    const m = n / pow;
    if (m <= 2) return 2 * pow;
    if (m <= 5) return 5 * pow;
    return 10 * pow;
  };
  const vmin = 0, vmax = niceMax(vMaxRaw);
  const tSpan = Math.max(1, t1 - t0);
  const vSpan = Math.max(1, vmax - vmin);
  const X = (t) => pad.l + ((t - t0) / tSpan) * w;
  const Y = (v) => pad.t + h - ((v - vmin) / vSpan) * h;
  const pts = data.map(d => [X(d.t), Y(d.v)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = path + ` L ${pts[pts.length - 1][0].toFixed(1)},${pad.t + h} L ${pts[0][0].toFixed(1)},${pad.t + h} Z`;

  /* Y-axis ticks — 5 evenly-spaced integer values from 0 to vmax */
  const yTicks = [0, 1, 2, 3, 4].map(i => {
    const v = Math.round(vmin + (vmax - vmin) * (i / 4));
    return { y: Y(v), v };
  });

  /* X-axis ticks — period-aware label format */
  const xTickCount = period === "30d" ? 6 : period === "7d" ? 7 : 5;
  const fmtX = (ts) => {
    const d = new Date(ts);
    if (period === "24h") return d.toLocaleTimeString([], { hour: "numeric" });
    if (period === "7d")  return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  const xTicks = [];
  for (let i = 0; i < xTickCount; i++) {
    const ts = t0 + (tSpan * i) / (xTickCount - 1 || 1);
    xTicks.push({ x: X(ts), label: fmtX(ts) });
  }

  /* Hover hit-targets — invisible vertical strips, one per data point.
     Each carries a native <title> tooltip with timestamp + count, so
     mousing over the chart shows the value at any point. Visible dots
     mark each sample. */
  const fmtHover = (d) => {
    const dt = new Date(d.t);
    const dateLabel = period === "24h"
      ? dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : dt.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric" });
    return `${dateLabel} — ${d.v} online`;
  };
  const stripW = data.length > 1 ? w / (data.length - 1) : w;
  /* Always render dots — even high-count datasets benefit from visible
     sample markers. Slightly bigger (r=3) + darker stroke = readable
     against the slime gradient. */
  const dots = data.map((d, i) =>
    `<circle data-i="${i}" cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="${data.length > 80 ? 2 : 3}" fill="var(--slime)" stroke="rgba(13,12,26,0.85)" stroke-width="1.2" class="srv-chart-dot"/>`
  ).join("");
  /* Hover strips with inline event handlers that drive a custom HTML
     tooltip (window._srvChartHover). The strip carries the label
     attribute so the handler reads it directly — no per-point closures. */
  const hoverStrips = data.map((d, i) => {
    const cx = pts[i][0];
    const x = Math.max(pad.l, cx - stripW / 2);
    const wStrip = Math.min(stripW, W - pad.r - x);
    const label = fmtHover(d).replace(/"/g, "&quot;");
    return `<rect x="${x.toFixed(1)}" y="${pad.t}" width="${wStrip.toFixed(1)}" height="${h.toFixed(1)}"
      fill="transparent" pointer-events="all" data-i="${i}" data-label="${label}"
      onmouseenter="window._srvChartHover && window._srvChartHover(this, event)"
      onmousemove="window._srvChartHover && window._srvChartHover(this, event)"
      onmouseleave="window._srvChartHover && window._srvChartHover(null)"/>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" preserveAspectRatio="xMidYMid meet">
    <defs><linearGradient id="srv-chart-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--slime)" stop-opacity="0.45"/>
      <stop offset="1" stop-color="var(--slime)" stop-opacity="0"/>
    </linearGradient></defs>
    <text x="8" y="14" fill="rgba(232,236,242,0.65)" font-size="11" font-weight="600" font-family="system-ui,sans-serif">players</text>
    ${yTicks.map(t => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${t.y.toFixed(1)}" y2="${t.y.toFixed(1)}" stroke="rgba(255,255,255,0.06)"/>`).join("")}
    ${yTicks.map(t => `<text x="${(pad.l - 8).toFixed(1)}" y="${(t.y + 4).toFixed(1)}" text-anchor="end" fill="rgba(232,236,242,0.55)" font-size="11" font-family="system-ui,sans-serif">${t.v}</text>`).join("")}
    ${xTicks.map(t => `<text x="${t.x.toFixed(1)}" y="${(H - 12).toFixed(1)}" text-anchor="middle" fill="rgba(232,236,242,0.55)" font-size="11" font-family="system-ui,sans-serif">${escapeHtml(t.label)}</text>`).join("")}
    <path d="${area}" fill="url(#srv-chart-grad)"/>
    <path d="${path}" fill="none" stroke="var(--slime)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    ${hoverStrips}
  </svg>`;
}

/* Custom HTML tooltip for the online chart (replaces native <title>
   browser tooltips which are slow + un-styled). Single global div
   re-used across all chart hovers. Highlights the focused dot too. */
if (typeof window !== "undefined" && !window._srvChartHover) {
  window._srvChartHover = function (el, ev) {
    let tip = document.getElementById("srv-chart-tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "srv-chart-tip";
      tip.style.cssText = "position:fixed;pointer-events:none;z-index:9999;background:rgba(20,22,32,0.96);color:#e8ecf2;padding:6px 10px;border:1px solid rgba(80,232,120,0.35);border-radius:6px;font:600 12px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,0.45);opacity:0;transition:opacity .1s ease;white-space:nowrap";
      document.body.appendChild(tip);
    }
    /* Clear all previous dot highlights */
    document.querySelectorAll(".srv-chart-dot.hover").forEach(d => {
      d.classList.remove("hover");
      d.setAttribute("r", d.dataset.r0 || 3);
    });
    if (!el) { tip.style.opacity = "0"; return; }
    const label = el.getAttribute("data-label") || "";
    tip.textContent = label;
    const x = (ev && ev.clientX) || 0, y = (ev && ev.clientY) || 0;
    tip.style.left = Math.min(window.innerWidth - 200, x + 14) + "px";
    tip.style.top = Math.max(8, y - 32) + "px";
    tip.style.opacity = "1";
    /* Highlight the matching dot */
    const i = el.getAttribute("data-i");
    const dot = document.querySelector('.srv-chart-dot[data-i="' + i + '"]');
    if (dot) {
      if (!dot.dataset.r0) dot.dataset.r0 = dot.getAttribute("r");
      dot.classList.add("hover");
      dot.setAttribute("r", "5");
    }
  };
}

const BOSS_ICONS = {
  snake_boss: "🐍", rock_golem: "🪨", slime_daddy: "🟢", frost_yeti: "❄️",
  dragon: "🐉", skele: "💀", spider: "🕷️", wizard: "🧙", alien: "👽",
  giant_cave_slime: "🟢",
};
const BOSS_LABELS = {
  snake_boss: "Snake Boss", rock_golem: "Rock Golem", slime_daddy: "Slime Daddy",
  frost_yeti: "Frost Yeti", dragon: "Dragon", skele: "Skele", spider: "Spider",
  wizard: "Wizard", alien: "Alien", giant_cave_slime: "Giant Cave Slime",
};
const SKILL_LABELS = {
  fishing: "Fishing 🎣", mining: "Mining ⛏️", woodcutting: "Woodcutting 🪓",
  melee: "Melee ⚔️", bow: "Bow 🏹", mage: "Mage ✨",
  cooking: "Cooking 🍳", hitpoints: "Hitpoints ❤️", survival: "Survival 🍃",
  farming: "Farming 🌾", scribing: "Scribing 📜", faith: "Faith ✨",
  explorer: "Explorer 🧭",
};
function prettySkill(key) { return SKILL_LABELS[key] || (key[0]?.toUpperCase() + key.slice(1)); }
function prettyBoss(key)  { return BOSS_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

function renderBossList(rows) {
  if (!rows?.length) return `<div class="st-empty">No boss kills yet today.</div>`;
  return rows.map(r => `
    <div class="srv-feed-row">
      <div class="srv-feed-icon">${BOSS_ICONS[r.boss] || "👹"}</div>
      <div class="srv-feed-body">
        <div class="srv-feed-line"><a href="#player?name=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a> killed <b>${escapeHtml(BOSS_LABELS[r.boss] || r.boss)}</b></div>
        <div class="srv-feed-meta">${timeAgo(Number(r.t) * 1000)}</div>
      </div>
    </div>`).join("");
}
function renderIslandList(rows) {
  if (!rows?.length) return `<div class="st-empty">No islands charted yet this week.</div>`;
  return rows.map(r => `
    <div class="srv-feed-row">
      <div class="srv-feed-icon">🗺️</div>
      <div class="srv-feed-body">
        <div class="srv-feed-line"><a href="#player?name=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a> charted a new island</div>
        <div class="srv-feed-meta">${timeAgo(Number(r.t) * 1000)} <span class="srv-feed-key">· ${escapeHtml(r.island)}</span></div>
      </div>
    </div>`).join("");
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function renderHeatmap(rows) {
  if (!rows?.length) return `<div class="st-empty">Not enough data yet — heatmap fills in over the first 14 days.</div>`;
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  let max = 0;
  for (const r of rows) {
    const d = Number(r.dow), h = Number(r.hour), v = Number(r.avg_online) || 0;
    if (d >= 0 && d < 7 && h >= 0 && h < 24) {
      grid[d][h] = v;
      if (v > max) max = v;
    }
  }
  const heatColor = (v) => {
    if (max <= 0 || v <= 0) return "var(--srv-border)";
    const t = v / max;
    const r = Math.round(20 + (60 - 20) * t);
    const g = Math.round(80 + (232 - 80) * t);
    const b = Math.round(40 + (120 - 40) * t);
    return `rgb(${r},${g},${b})`;
  };
  let html = "";
  for (let d = 0; d < 7; d++) {
    html += `<div class="srv-heat-label">${DOW_LABELS[d]}</div>`;
    for (let h = 0; h < 24; h++) {
      const v = grid[d][h];
      html += `<div class="srv-heat-cell" style="background:${heatColor(v)}" title="${DOW_LABELS[d]} ${h}:00 — avg ${v} online"></div>`;
    }
  }
  let hours = `<div></div>`;
  for (let h = 0; h < 24; h++) hours += `<div>${h % 6 === 0 ? h : ""}</div>`;
  return `<div class="srv-heatmap">${html}</div><div class="srv-heat-hours">${hours}</div>`;
}
