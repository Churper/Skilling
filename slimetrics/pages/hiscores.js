import { escapeHtml } from "../lib/nav.js";
import { api } from "../lib/api.js";
import { nf } from "../lib/format.js";
import { SKILLS, skillLabel } from "../lib/skills.js";
import { ACCOUNT_TYPES } from "../lib/config.js";
import { xpToLevel } from "../lib/progression.js";

const PAGE_SIZE = 50;

export async function renderHiscores($page, params = {}) {
  const state = {
    skill: params.skill || "overall",
    type:  params.type  || "all",
    offset: Math.max(0, parseInt(params.page || "0", 10)) * PAGE_SIZE,
  };
  $page.innerHTML = `<div class="st-loading">Loading hiscores…</div>`;
  try {
    const res = await api.hiscores(state.skill, state.type, state.offset, PAGE_SIZE);
    paint($page, state, res);
  } catch (e) {
    $page.innerHTML = `<div class="st-error">${escapeHtml(e.message || e)}</div>`;
  }
}

function paint($page, state, res) {
  const rows = res?.rows || [];
  $page.innerHTML = `
    <div class="shell">
      <h1 class="st-page-title">Hiscores</h1>
      <p class="st-page-sub">${state.skill === "overall" ? "Total level" : skillLabel(state.skill) + " XP"} leaderboard.</p>

      <div class="st-card">
        <div class="st-card-head">
          <div class="st-card-title">Skill</div>
          <div class="st-pills right">${[
            { id: "overall", label: "Overall", icon: "📊" },
            ...SKILLS.map(s => ({ id: s.id, label: s.label, icon: s.icon }))
          ].map(s => `<button class="st-pill ${s.id === state.skill ? "is-active" : ""}" data-skill="${s.id}">${escapeHtml(s.icon)} ${escapeHtml(s.label)}</button>`).join("")}</div>
        </div>
        <div class="st-card-head" style="border-top:1px solid var(--line)">
          <div class="st-card-title">Account</div>
          <div class="st-pills right">${ACCOUNT_TYPES.map(t => `<button class="st-pill ${t.id === state.type ? "is-active" : ""}" data-type="${t.id}">${escapeHtml(t.label)}</button>`).join("")}</div>
        </div>
      </div>

      <div class="st-card" style="margin-top:18px">
        ${rows.length ? renderTable(rows, state) : `<div class="st-empty">No players in this category yet.</div>`}
        ${renderPager(rows.length, state)}
      </div>
    </div>
  `;
  wire($page, state);
}

function renderTable(rows, state) {
  if (state.skill === "overall") {
    return `<table class="st-table">
      <thead><tr><th>Rank</th><th>Slime</th><th class="num">Total Level</th></tr></thead>
      <tbody>${rows.map(r => {
        const rank = r.rk + state.offset;
        const cls = rank === 1 ? "rank-r1" : rank === 2 ? "rank-r2" : rank === 3 ? "rank-r3" : "";
        return `
        <tr onclick="location.hash='#player?name=${encodeURIComponent(r.name)}'">
          <td class="rank-cell ${cls}">#${nf(rank)}</td>
          <td>${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}<a href="#player?name=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a></td>
          <td class="num">${nf(r.total_level)}</td>
        </tr>`;
      }).join("")}
      </tbody>
    </table>`;
  }
  return `<table class="st-table">
    <thead><tr><th>Rank</th><th>Slime</th><th class="num">Level</th><th class="num">XP</th></tr></thead>
    <tbody>${rows.map(r => {
      const rank = r.rk + state.offset;
      const cls = rank === 1 ? "rank-r1" : rank === 2 ? "rank-r2" : rank === 3 ? "rank-r3" : "";
      const lvl = xpToLevel(Number(r.xp_val || 0));
      return `
      <tr onclick="location.hash='#player?name=${encodeURIComponent(r.name)}'">
        <td class="rank-cell ${cls}">#${nf(rank)}</td>
        <td>${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}<a href="#player?name=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a></td>
        <td class="num">${nf(lvl)}</td>
        <td class="num">${nf(r.xp_val || 0)}</td>
      </tr>`;
    }).join("")}
    </tbody>
  </table>`;
}

function renderPager(rowCount, state) {
  const page = Math.floor(state.offset / PAGE_SIZE);
  return `<div style="display:flex;gap:8px;justify-content:center;margin:14px 0">
    <button class="st-pill" id="prev" ${page === 0 ? "disabled" : ""}>← Prev</button>
    <span class="muted" style="align-self:center;font-size:13px">Page ${page + 1}</span>
    <button class="st-pill" id="next" ${rowCount < PAGE_SIZE ? "disabled" : ""}>Next →</button>
  </div>`;
}

function wire($page, state) {
  $page.querySelectorAll("[data-skill]").forEach(b => b.addEventListener("click", () => sync({ ...state, skill: b.dataset.skill, offset: 0 })));
  $page.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", () => sync({ ...state, type: b.dataset.type, offset: 0 })));
  $page.querySelector("#prev")?.addEventListener("click", () => sync({ ...state, offset: Math.max(0, state.offset - PAGE_SIZE) }));
  $page.querySelector("#next")?.addEventListener("click", () => sync({ ...state, offset: state.offset + PAGE_SIZE }));
}
function sync(s) {
  const page = Math.floor(s.offset / PAGE_SIZE);
  location.hash = `#hiscores?skill=${encodeURIComponent(s.skill)}&type=${encodeURIComponent(s.type)}&page=${page}`;
}
