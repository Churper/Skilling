import { escapeHtml } from "../lib/nav.js";
import { api, bustCache } from "../lib/api.js";
import { nf, nfSigned, nfShort, dateLabel, timeAgo } from "../lib/format.js";
import { SKILLS, skillIcon, skillLabel, skillColor } from "../lib/skills.js";
import { xpToLevel, levelProgress } from "../lib/progression.js";
import { PERIODS } from "../lib/config.js";
import { lineChart, donutChart, heatmap } from "../lib/chart.js";

let _state = {
  name: null,
  overview: null,
  gains: {},
  chart: { skill: "overall", period: "1w", data: null },
  rankChart: null,
  heat: null,
  period: "1w",
  focusSkill: "overall",
};

export async function renderPlayer($page, params = {}) {
  const NAME = (params.name || "").trim();
  if (!NAME) {
    $page.innerHTML = `
      <main><div class="shell">
        <h1 class="st-page-title">No player selected</h1>
        <p class="st-page-sub">Use the search box in the header, or pick someone from
        <a href="#players">players</a> · <a href="#hiscores">hiscores</a> · <a href="#gainers">gainers</a>.</p>
      </div></main>`;
    return;
  }

  /* Reset state for new player. */
  _state = {
    name: NAME, overview: null, gains: {}, chart: { skill: "overall", period: "1w", data: null },
    rankChart: null, heat: null, period: "1w", focusSkill: "overall",
  };

  try {
    const overview = await api.overview(NAME);
    if (!overview?.ok) {
      $page.innerHTML = `<main><div class="shell"><div class="st-error">Player not found: ${escapeHtml(NAME)}. <a href="#home">← Home</a></div></div></main>`;
      return;
    }
    /* If the URL name doesn't match the player's current name, they
       got renamed (or were under a synthesized fallback name like
       SlimeXXXX). Surface this so users aren't confused. */
    if (overview.name && overview.name.toLowerCase() !== NAME.toLowerCase()) {
      overview._formerName = NAME;
    }
    _state.overview = overview;
    const [gains, chart, heat, rankChart] = await Promise.all([
      api.gains(NAME, _state.period),
      api.chart(NAME, _state.focusSkill, _state.period),
      api.heatmap(NAME),
      /* Rank chart always uses daily resolution — rank changes slowly so
         hourly is overkill. Fixed period = 'all' shows the full history. */
      api.chart(NAME, "overall", "all"),
    ]);
    _state.gains[_state.period] = gains;
    _state.chart = { skill: _state.focusSkill, period: _state.period, data: chart };
    _state.heat = heat;
    _state.rankChart = rankChart;
    paint($page);
  } catch (e) {
    $page.innerHTML = `<main><div class="shell"><div class="st-error">Failed to load: ${escapeHtml(e.message || String(e))}</div></div></main>`;
  }
}

function paint($page) {
  const o = _state.overview;
  const NAME = _state.name;
  $page.innerHTML = `
    <div class="shell">
      ${renderHero(o)}
      ${renderHighlights(o)}
      <div class="st-grid-3" style="margin-top:18px">
        <div class="st-card st-card-headless st-heat-card">
          <div class="st-card-body">
            <span class="st-heat-tag">past 60 days</span>
            ${renderHeat()}
          </div>
        </div>
        <div class="st-card">
          <div class="st-card-head">
            <div class="st-card-title">${escapeHtml(_state.focusSkill === "overall" ? "Overall XP" : skillLabel(_state.focusSkill) + " XP")}</div>
            <span class="muted right">${escapeHtml(periodLabel(_state.period))}</span>
          </div>
          <div class="st-card-body">${renderChart()}</div>
        </div>
        <div class="st-card">
          <div class="st-card-head">
            <div class="st-card-title">Rank Over Time</div>
            <span class="muted right">past year</span>
          </div>
          <div class="st-card-body">${renderRankChart()}</div>
        </div>
      </div>
      <div class="st-card st-card-headless" style="margin-top:18px">
        ${renderSkillTable()}
      </div>
    </div>
  `;
  wire($page, NAME);
}

function renderHero(o) {
  const totalLvl = o.total_level || 0;
  const rank = o.overall_rank || 0;
  /* Pick a stable color seed from the player name so avatars feel personal. */
  const palette = [["#a4ffc8","#50e878","#2aa050"],["#ffd5a4","#ff9b50","#a05a20"],["#a4d8ff","#5098e8","#205aa0"],["#ffa4e8","#e850b8","#a02080"],["#d8a4ff","#a850e8","#5020a0"]];
  const seed = (o.name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const [c1, c2, c3] = palette[seed % palette.length];
  return `
    <div class="st-hero">
      <div class="st-pills st-hero-pills" id="st-period-pills">
        ${PERIODS.map(p => `<button class="st-pill ${p.id === _state.period ? "is-active" : ""}" data-period="${p.id}">${escapeHtml(p.label)}</button>`).join("")}
      </div>
      <div class="st-hero-avatar">
        ${slimeAvatar(c1, c2, c3)}
        ${rank > 0 ? `<div class="st-hero-rank-chip">#${nf(rank)}</div>` : ""}
      </div>
      <div class="st-hero-body">
        <div class="st-hero-name">${o.is_sapling ? `<span class="st-sap">🌱</span>` : ""}${escapeHtml(o.name)}</div>
        ${o._formerName ? `<div class="st-hero-aka" style="font-size:11px;color:var(--ui-ink-3);margin-top:-2px">previously seen as <code>${escapeHtml(o._formerName)}</code></div>` : ""}
        <div class="st-hero-sub">Total Level <strong>${nf(totalLvl)}</strong> · Total XP <strong>${nf(o.total_xp || 0)}</strong></div>
        <div class="st-hero-meta">
          <span>First tracked ${dateLabel(o.first_tracked)}</span>
          <span>Last checked ${timeAgo(o.last_snapshot)}</span>
          <span>${nf(o.data_points || 0)} datapoints</span>
          <span>${o.is_sapling ? "Sapling" : "Legacy"} account</span>
        </div>
        <div class="st-hero-actions">
          <button class="st-update-btn" id="st-update">Update Now</button>
        </div>
      </div>
    </div>
  `;
}

function slimeAvatar(c1, c2, c3) {
  const id = `pa-${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="${id}" cx="40%" cy="35%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="60%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c3}"/>
      </radialGradient>
    </defs>
    <ellipse cx="100" cy="180" rx="64" ry="8" fill="${c2}" opacity=".22"/>
    <path d="M30 130 Q30 60 100 48 Q170 60 170 130 Q170 178 100 178 Q30 178 30 130 Z" fill="url(#${id})" stroke="${c3}" stroke-width="2.5"/>
    <circle cx="76" cy="118" r="10" fill="#0d0c1a"/>
    <circle cx="124" cy="118" r="10" fill="#0d0c1a"/>
    <circle cx="80" cy="114" r="3" fill="#fff"/>
    <circle cx="128" cy="114" r="3" fill="#fff"/>
    <path d="M88 145 Q100 153 112 145" stroke="#0d0c1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="62" cy="84" rx="14" ry="10" fill="#fff" opacity=".35"/>
  </svg>`;
}

function renderHighlights(o) {
  const segs = SKILLS.map(s => {
    const xp = Number(o.current_xp?.[s.id] || 0);
    return { label: s.label, value: xp, color: s.color, level: xpToLevel(xp) };
  });
  const sumXp = segs.reduce((a, b) => a + b.value, 0);
  return `
    <div class="st-card st-card-headless" style="margin-top:12px">
      <div class="st-card-body">
        <div class="st-highlights">
          <div class="st-highlight-stats">
            <div class="st-highlight-stat"><div class="big">#${nf(o.overall_rank || 0)}</div><div class="lbl">Overall ranking</div></div>
            <div class="st-highlight-stat"><div class="big">${nf(o.total_level || 0)}</div><div class="lbl">Total level</div></div>
            <div class="st-highlight-stat"><div class="big">${nf(o.data_points || 0)}</div><div class="lbl">Datapoints tracked</div></div>
          </div>
          <div>${donutChart(segs, { centerLabel: nfShort(sumXp), centerSub: "TOTAL XP" })}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTabs() {
  return `
    <div class="st-card" style="margin-top:18px">
      <div class="st-card-head">
        <div class="st-card-title">Time Period</div>
        <div class="st-pills right" id="st-period-pills">
          ${PERIODS.map(p => `<button class="st-pill ${p.id === _state.period ? "is-active" : ""}" data-period="${p.id}">${escapeHtml(p.label)}</button>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderSkillTable() {
  const o = _state.overview;
  const gains = _state.gains[_state.period];
  const skillDelta = gains?.skill_delta || {};
  const totalDelta = gains?.total_delta || 0;
  const totalLvlDelta = gains?.level_delta || 0;
  const rows = [];
  rows.push(`
    <tr class="is-overall ${_state.focusSkill === "overall" ? "is-active" : ""}" data-skill="overall">
      <td class="skill-cell"><span class="icon">📊</span> Overall</td>
      <td class="num">${nf(o.total_level || 0)}${totalLvlDelta > 0 ? ` <span class="gain-pos">+${nf(totalLvlDelta)}</span>` : ""}</td>
      <td><span class="muted">—</span></td>
      <td class="num">${nf(o.total_xp || 0)}</td>
      <td class="num ${totalDelta > 0 ? "gain-pos" : totalDelta < 0 ? "gain-neg" : ""}">${nfSigned(totalDelta)}</td>
    </tr>
  `);
  for (const s of SKILLS) {
    const xp = Number(o.current_xp?.[s.id] || 0);
    const lvl = xpToLevel(xp);
    const prog = levelProgress(xp);
    const d = Number(skillDelta[s.id] || 0);
    rows.push(`
      <tr data-skill="${s.id}" ${_state.focusSkill === s.id ? `class="is-active"` : ""}>
        <td class="skill-cell"><span class="icon">${escapeHtml(s.icon)}</span> ${escapeHtml(s.label)}</td>
        <td class="num">${nf(lvl)}</td>
        <td>
          <div class="st-prog" title="${(prog*100).toFixed(0)}% to ${lvl + 1}">
            <div class="st-prog-fill" style="transform: scaleX(${prog.toFixed(3)})"></div>
            <div class="st-prog-text">${(prog*100).toFixed(0)}%</div>
          </div>
        </td>
        <td class="num">${nf(xp)}</td>
        <td class="num ${d > 0 ? "gain-pos" : d < 0 ? "gain-neg" : ""}">${nfSigned(d)}</td>
      </tr>
    `);
  }
  return `<table class="st-table">
    <thead><tr><th>Skill</th><th class="num">Level</th><th>%</th><th class="num">XP</th><th class="num">XP gained</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

function renderChart() {
  const c = _state.chart.data;
  if (!c?.ok) return `<div class="st-empty">Chart unavailable.</div>`;
  const points = (c.points || []).map(p => ({ t: p.t, v: p.xp }));
  const color = _state.focusSkill === "overall" ? "#50e878" : skillColor(_state.focusSkill);
  /* Smaller viewBox in the 3-col row so axis labels don't shrink to the
     point of being unreadable when the SVG scales down to ~300px wide. */
  return lineChart(points, { color, width: 380, height: 220 });
}

function renderRankChart() {
  const c = _state.rankChart;
  if (!c?.ok) return `<div class="st-empty">Rank history unavailable.</div>`;
  const _RANK_W = 380, _RANK_H = 220;
  /* Daily snapshots include `r` (overall_rank). Invert the value so the
     graph reads "up = better rank" — visually intuitive even though raw
     rank is lower-is-better. We preserve the original rank in the label
     via a wrapper that flips the Y axis after render. */
  const ranks = (c.points || []).filter(p => p.r != null && p.r > 0);
  if (!ranks.length) return `<div class="st-empty">Not enough data yet — fills in once daily snapshots accumulate.</div>`;
  const maxR = Math.max(...ranks.map(p => p.r));
  /* Plot (maxR - rank + 1) so up = better. Y labels stay numeric but
     reflect inverted scale. We post-process the SVG to overwrite the
     y-axis text labels with the original rank values. */
  const flipped = ranks.map(p => ({ t: p.t, v: maxR - p.r + 1, _origRank: p.r }));
  let svg = lineChart(flipped, { color: "#ffd840", label: "Rank over time", width: _RANK_W, height: _RANK_H });
  /* Overwrite Y-axis tick labels with #-prefixed real rank numbers. The
     line chart writes labels using nfShort(v); we recompute v→rank and
     replace each label string. Quick string-mode patch. */
  svg = svg.replace(/<text [^>]*class="st-chart-axis"[^>]*>([0-9.,kMB]+)<\/text>/g, (m, lbl) => {
    /* Only swap left-side y-axis labels — we identify them by `text-anchor="end"`. */
    if (!m.includes('text-anchor="end"')) return m;
    /* Parse short label back to a number, flip, format as `#N` */
    let n = parseFloat(lbl.replace(/,/g, ""));
    if (lbl.endsWith("k")) n *= 1e3;
    else if (lbl.endsWith("M")) n *= 1e6;
    else if (lbl.endsWith("B")) n *= 1e9;
    const rank = Math.max(1, Math.round(maxR - n + 1));
    return m.replace(lbl, `#${rank.toLocaleString("en-US")}`);
  });
  return svg;
}

function renderHeat() {
  const h = _state.heat;
  if (!h?.ok) return `<div class="st-empty">Heatmap unavailable.</div>`;
  /* Rectangular cells (wider than tall) push the SVG aspect to ~1.6:1 so
     the heatmap fills the column width without growing taller than the
     chart cards next to it. 8 weeks ≈ 56 days. */
  return heatmap(h.days || [], { weeks: 8, cellW: 28, cellH: 20, gap: 2 });
}

function periodLabel(id) { return PERIODS.find(p => p.id === id)?.label || id; }

function wire($page, NAME) {
  $page.querySelectorAll("#st-period-pills .st-pill").forEach(b => {
    b.addEventListener("click", async () => {
      const p = b.dataset.period;
      if (!p || p === _state.period) return;
      _state.period = p;
      if (!_state.gains[p]) {
        b.disabled = true;
        const [g, c] = await Promise.all([api.gains(NAME, p), api.chart(NAME, _state.focusSkill, p)]);
        _state.gains[p] = g;
        _state.chart = { skill: _state.focusSkill, period: p, data: c };
        b.disabled = false;
      } else {
        _state.chart = { ..._state.chart, period: p, data: await api.chart(NAME, _state.focusSkill, p) };
      }
      paint($page);
    });
  });
  $page.querySelectorAll("[data-skill]").forEach(row => {
    row.addEventListener("click", async () => {
      const sk = row.dataset.skill;
      if (sk === _state.focusSkill) return;
      _state.focusSkill = sk;
      _state.chart = { skill: sk, period: _state.period, data: await api.chart(NAME, sk, _state.period) };
      paint($page);
    });
  });
  const btn = $page.querySelector("#st-update");
  if (btn) btn.addEventListener("click", async () => {
    btn.disabled = true; btn.textContent = "Updating…";
    const r = await api.requestUpdate(NAME);
    if (r?.ok && r.snapshotted) {
      btn.textContent = "Snapshot taken — reloading";
      bustCache();
      setTimeout(() => location.reload(), 600);
    } else if (r?.ok && r.throttled_secs) {
      btn.textContent = `Wait ${r.throttled_secs}s…`;
      setTimeout(() => { btn.textContent = "Update Now"; btn.disabled = false; }, Math.max(2000, r.throttled_secs * 1000));
    } else {
      btn.textContent = "Update failed";
      setTimeout(() => { btn.textContent = "Update Now"; btn.disabled = false; }, 1500);
    }
  });
}
