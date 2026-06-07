import { escapeHtml, filterRow } from "../lib/nav.js";
import { api } from "../lib/api.js";
import { nf } from "../lib/format.js";
import { SKILLS, skillLabel } from "../lib/skills.js";
import { ACCOUNT_TYPES } from "../lib/config.js";

const PERIODS = [
  { id: "1d", label: "24 Hours" },
  { id: "1w", label: "7 Days" },
  { id: "1m", label: "30 Days" },
  { id: "1y", label: "1 Year" },
];

export async function renderGainers($page, params = {}) {
  const state = {
    period: params.period || "1w",
    skill:  params.skill  || "overall",
    type:   params.type   || "all",
  };
  $page.innerHTML = `<div class="st-loading">Loading gainers…</div>`;
  try {
    const res = await api.gainers(state.period, state.skill, state.type, 100);
    paint($page, state, res);
  } catch (e) {
    $page.innerHTML = `<div class="st-error">${escapeHtml(e.message || e)}</div>`;
  }
}

function paint($page, state, res) {
  const rows = res?.rows || [];
  $page.innerHTML = `
    <div class="shell">
      <h1 class="st-page-title">Top Gainers</h1>
      <p class="st-page-sub">Most ${state.skill === "overall" ? "total" : skillLabel(state.skill)} XP gained.</p>

      <div class="st-filters">
        ${filterRow("Window", PERIODS, state.period, "data-period", { row: true })}
        ${filterRow("Skill", [
          { id: "overall", label: "Overall", icon: "📊" },
          ...SKILLS.map(s => ({ id: s.id, label: s.label, icon: s.icon }))
        ], state.skill, "data-skill")}
        ${filterRow("Account", ACCOUNT_TYPES, state.type, "data-type", { row: true })}
      </div>

      <div class="st-card" style="margin-top:18px">
        ${rows.length ? `<table class="st-table">
          <thead><tr><th>Rank</th><th>Slime</th><th class="num">XP Gained</th></tr></thead>
          <tbody>${rows.map((r, i) => {
            const rank = i + 1;
            const cls = rank === 1 ? "rank-r1" : rank === 2 ? "rank-r2" : rank === 3 ? "rank-r3" : "";
            return `
            <tr onclick="location.hash='#player?name=${encodeURIComponent(r.name)}'">
              <td class="rank-cell ${cls}">#${rank}</td>
              <td>${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}<a href="#player?name=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a></td>
              <td class="num gain-pos">+${nf(r.gained || 0)}</td>
            </tr>`;
          }).join("")}
          </tbody>
        </table>` : `<div class="st-empty">No gains tracked yet for this window. Come back after a few snapshots accumulate.</div>`}
      </div>
    </div>
  `;
  wire($page, state);
}

function wire($page, state) {
  $page.querySelectorAll("[data-period]").forEach(b => b.addEventListener("click", () => sync({ ...state, period: b.dataset.period })));
  $page.querySelectorAll("[data-skill]").forEach(b => b.addEventListener("click", () => sync({ ...state, skill: b.dataset.skill })));
  $page.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", () => sync({ ...state, type: b.dataset.type })));
}
function sync(s) {
  location.hash = `#gainers?period=${encodeURIComponent(s.period)}&skill=${encodeURIComponent(s.skill)}&type=${encodeURIComponent(s.type)}`;
}
