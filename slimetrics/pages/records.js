import { escapeHtml, filterRow } from "../lib/nav.js";
import { api } from "../lib/api.js";
import { nf, dateLabel } from "../lib/format.js";
import { SKILLS, skillLabel } from "../lib/skills.js";
import { ACCOUNT_TYPES } from "../lib/config.js";

export async function renderRecords($page, params = {}) {
  const state = {
    skill: params.skill || "overall",
    type:  params.type  || "all",
  };
  $page.innerHTML = `<div class="st-loading">Loading records…</div>`;
  try {
    const res = await api.records(state.skill, state.type, 100);
    paint($page, state, res);
  } catch (e) {
    $page.innerHTML = `<div class="st-error">${escapeHtml(e.message || e)}</div>`;
  }
}

function paint($page, state, res) {
  const rows = res?.rows || [];
  $page.innerHTML = `
    <div class="shell">
      <h1 class="st-page-title">Records</h1>
      <p class="st-page-sub">Best single-day ${state.skill === "overall" ? "total" : skillLabel(state.skill)} XP gain across all of history.</p>

      <div class="st-filters">
        ${filterRow("Skill", [
          { id: "overall", label: "Overall", icon: "📊" },
          ...SKILLS.map(s => ({ id: s.id, label: s.label, icon: s.icon }))
        ], state.skill, "data-skill")}
        ${filterRow("Account", ACCOUNT_TYPES, state.type, "data-type", { row: true })}
      </div>

      <div class="st-card" style="margin-top:18px">
        ${rows.length ? `<table class="st-table">
          <thead><tr><th>Rank</th><th>Slime</th><th class="num">Best Day XP</th><th class="num">Date</th></tr></thead>
          <tbody>${rows.map((r, i) => {
            const rank = i + 1;
            const cls = rank === 1 ? "rank-r1" : rank === 2 ? "rank-r2" : rank === 3 ? "rank-r3" : "";
            return `
            <tr onclick="location.hash='#player?name=${encodeURIComponent(r.name)}'">
              <td class="rank-cell ${cls}">#${rank}</td>
              <td>${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}<a href="#player?name=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a></td>
              <td class="num gain-pos">+${nf(r.best_day || 0)}</td>
              <td class="num">${dateLabel(r.day)}</td>
            </tr>`;
          }).join("")}
          </tbody>
        </table>` : `<div class="st-empty">No records yet. Records appear after at least 2 days of snapshots.</div>`}
      </div>
    </div>
  `;
  wire($page, state);
}

function wire($page, state) {
  $page.querySelectorAll("[data-skill]").forEach(b => b.addEventListener("click", () => sync({ ...state, skill: b.dataset.skill })));
  $page.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", () => sync({ ...state, type: b.dataset.type })));
}
function sync(s) {
  location.hash = `#records?skill=${encodeURIComponent(s.skill)}&type=${encodeURIComponent(s.type)}`;
}
