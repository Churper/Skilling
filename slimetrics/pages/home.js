import { escapeHtml } from "../lib/nav.js";
import { api } from "../lib/api.js";
import { nf, nfShort, timeAgo } from "../lib/format.js";
import { skillIcon, skillLabel, skillColor } from "../lib/skills.js";

export async function renderHome($page) {
  try {
    const home = await api.home();
    if (!home?.ok) throw new Error(home?.error || "load failed");
    paint($page, home);
  } catch (e) {
    $page.innerHTML = `<div class="st-error">Failed to load: ${escapeHtml(e.message || e)}</div>`;
  }
}

function paint($page, home) {
  $page.innerHTML = `
    <div class="shell">
      <div class="home-strip">
        <div class="home-strip-art">${miniSlime()}</div>
        <div class="home-strip-body">
          <div class="eyebrow">Slimeville Online · XP tracker</div>
          <h1 class="home-strip-title">Look up a <em>slime</em>.</h1>
          <form class="home-strip-search" id="home-search-form">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" placeholder="enter a slime name…" id="home-search-input" autocomplete="off"/>
            <button class="st-btn primary" type="submit">Track</button>
          </form>
          <div class="home-strip-stats">
            <span><b class="num">${nf(home.players)}</b> slimes</span>
            <span class="dot-sep"></span>
            <span><b class="num">${nfShort(home.data_points)}</b> datapoints</span>
            <span class="dot-sep"></span>
            <span><b class="num">13</b> skills</span>
          </div>
        </div>
      </div>

      <div class="grid-2" style="margin-top:18px">
        <div class="st-card">
          <div class="st-card-head">
            <div class="st-card-title"><span class="pulse"></span>Recent Highlights</div>
            <div class="eyebrow">live</div>
          </div>
          ${renderFeed(home.highlights || [])}
        </div>
        <div class="st-card">
          <div class="st-card-head">
            <div class="st-card-title">New Tracked Slimes</div>
            <div class="eyebrow">${(home.new_users || []).length} this week</div>
          </div>
          ${renderNewUsers(home.new_users || [])}
        </div>
      </div>

      <div class="section-head"><h2 class="section-title">Top Gainers</h2><div class="eyebrow">across all skills</div></div>
      <div class="grid-3">
        ${gainerCard("24 Hours",  home.gainers_24h || [], "var(--slime)")}
        ${gainerCard("7 Days",    home.gainers_1w  || [], "var(--slime-2)")}
        ${gainerCard("30 Days",   home.gainers_1m  || [], "var(--sapling)")}
      </div>
    </div>
  `;

  const form = $page.querySelector("#home-search-form");
  const input = $page.querySelector("#home-search-input");
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (input.value || "").trim();
    if (v) location.hash = `#player?name=${encodeURIComponent(v)}`;
  });
}

function renderFeed(rows) {
  const feedRows = compactFeedRows(rows);
  if (!feedRows.length) return `<div class="st-empty">No recent levelups.</div>`;
  return `<div class="hl-list">${feedRows.map(r => {
    if (r.kind === "pvp_kill") {
      const c = "#ff6b9d";
      return `
    <a class="hl-row" href="#player?name=${encodeURIComponent(r.name)}" style="--accent:${c}">
      <div class="hl-icon" aria-hidden="true">⚔️</div>
      <div class="hl-body">
        <div class="hl-line">${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}<b>${escapeHtml(r.name)}</b> killed <b>${escapeHtml(r.victim_name || "a player")}</b> in PvP cave${r.count > 1 ? ` <span style="color:${c}">×${nf(r.count)}</span>` : ""}</div>
        <div class="hl-meta">${timeAgo(r.ts)}${r.count > 1 && rowTime(r.firstTs) !== rowTime(r.ts) ? ` · since ${timeAgo(r.firstTs)}` : ""}</div>
      </div>
    </a>`;
    }
    const c = skillColor(r.skill);
    return `
    <a class="hl-row" href="#player?name=${encodeURIComponent(r.name)}" style="--accent:${c}">
      <div class="hl-icon" aria-hidden="true">${escapeHtml(skillIcon(r.skill))}</div>
      <div class="hl-body">
        <div class="hl-line">${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}<b>${escapeHtml(r.name)}</b> reached level ${r.level} <span style="color:${c}">${escapeHtml(skillLabel(r.skill))}</span></div>
        <div class="hl-meta">${timeAgo(r.ts)}</div>
      </div>
    </a>`;
  }).join("")}</div>`;
}

function rowTime(rowOrTs) {
  const ts = rowOrTs && typeof rowOrTs === "object" ? rowOrTs.ts : rowOrTs;
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : 0;
  const t = Date.parse(ts || "");
  return Number.isFinite(t) ? t : 0;
}

function compactFeedRows(rows) {
  const pvp = new Map();
  const others = [];
  for (const r of rows || []) {
    if (r?.kind !== "pvp_kill") {
      others.push(r);
      continue;
    }
    const key = `${r.name || ""}|${r.victim_name || ""}`;
    const existing = pvp.get(key);
    if (existing) {
      existing.count += 1;
      existing.is_sapling = existing.is_sapling || r.is_sapling;
      if (rowTime(r) > rowTime(existing)) existing.ts = r.ts;
      if (!existing.firstTs || rowTime(r) < rowTime(existing.firstTs)) existing.firstTs = r.ts;
    } else {
      pvp.set(key, { ...r, count: 1, firstTs: r.ts });
    }
  }
  return [...others, ...pvp.values()].sort((a, b) => rowTime(b) - rowTime(a));
}

function renderNewUsers(rows) {
  if (!rows.length) return `<div class="st-empty">No tracked slimes yet.</div>`;
  return `<table class="st-table st-new-users-table">
    <thead><tr><th>Slime</th><th class="num">Total Lvl</th><th class="num">Tracked</th></tr></thead>
    <tbody>${rows.map(r => `
      <tr onclick="location.hash='#player?name=${encodeURIComponent(r.name)}'">
        <td class="st-new-user-cell"><span class="st-new-user-name">${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}<a href="#player?name=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a></span></td>
        <td class="num">${nf(r.total_level || 0)}</td>
        <td class="num muted">${timeAgo(r.first_tracked)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;
}

function gainerCard(label, rows, color) {
  if (!rows.length) {
    return `<div class="st-card gainer-card">
      <div class="st-card-head">
        <div class="st-card-title">Top Gainers</div>
        <div class="gainer-window" style="color:${color}">${escapeHtml(label)}</div>
      </div>
      <div class="st-empty">No data yet.</div>
    </div>`;
  }
  return `<div class="st-card gainer-card">
    <div class="st-card-head">
      <div class="st-card-title">Top Gainers</div>
      <div class="gainer-window" style="color:${color}">${escapeHtml(label)}</div>
    </div>
    <div>${rows.slice(0, 8).map((r, i) => `
      <a class="gainer-row" href="#player?name=${encodeURIComponent(r.name)}">
        <div class="rank ${i < 3 ? "top" : ""}">${i + 1}</div>
        <div class="who">${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}${escapeHtml(r.name)}</div>
        <div class="gain delta-up num">+${nfShort(r.gained || 0)}</div>
      </a>`).join("")}
    </div>
  </div>`;
}

function miniSlime() {
  /* Compact slime — same shape as full hero but sized for inline strip use. */
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="sg-mini" cx="40%" cy="35%">
        <stop offset="0%" stop-color="#a4ffc8"/>
        <stop offset="60%" stop-color="#50e878"/>
        <stop offset="100%" stop-color="#2aa050"/>
      </radialGradient>
    </defs>
    <ellipse cx="100" cy="180" rx="64" ry="8" fill="#50e878" opacity=".22"/>
    <path d="M30 130 Q30 60 100 48 Q170 60 170 130 Q170 178 100 178 Q30 178 30 130 Z" fill="url(#sg-mini)" stroke="#2aa050" stroke-width="2.5"/>
    <circle cx="76" cy="118" r="10" fill="#0d0c1a"/>
    <circle cx="124" cy="118" r="10" fill="#0d0c1a"/>
    <circle cx="80" cy="114" r="3" fill="#fff"/>
    <circle cx="128" cy="114" r="3" fill="#fff"/>
    <path d="M88 145 Q100 153 112 145" stroke="#0d0c1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="62" cy="84" rx="14" ry="10" fill="#fff" opacity=".35"/>
  </svg>`;
}
