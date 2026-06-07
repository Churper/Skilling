import { escapeHtml, filterRow } from "../lib/nav.js";
import { api } from "../lib/api.js";
import { nf } from "../lib/format.js";
import { SKILLS, skillLabel } from "../lib/skills.js";
import { ACCOUNT_TYPES } from "../lib/config.js";
import { xpToLevel } from "../lib/progression.js";
import { bossKeyForKc, bossSpriteHtml, renderBossSprites } from "../lib/bossSprites.js";

const PAGE_SIZE = 50;
const BOSS_KCS = [
  { id: "boss_kc", label: "Total Boss KC", icon: "👑" },
  { id: "snake_kc", label: "Snake", bossKey: bossKeyForKc("snake_kc") },
  { id: "golem_kc", label: "Golem", bossKey: bossKeyForKc("golem_kc") },
  { id: "slime_daddy_kc", label: "Slime Daddy", bossKey: bossKeyForKc("slime_daddy_kc") },
  { id: "cave_slime_kc", label: "Cave Slime", bossKey: bossKeyForKc("cave_slime_kc") },
  { id: "yeti_kc", label: "Yeti", bossKey: bossKeyForKc("yeti_kc") },
  { id: "dragon_kc", label: "Dragon", bossKey: bossKeyForKc("dragon_kc") },
  { id: "skele_kc", label: "Skele", bossKey: bossKeyForKc("skele_kc") },
  { id: "spider_kc", label: "Spider", bossKey: bossKeyForKc("spider_kc") },
  { id: "wizard_kc", label: "Wizard", bossKey: bossKeyForKc("wizard_kc") },
  { id: "alien_kc", label: "Alien", bossKey: bossKeyForKc("alien_kc") },
];
const BOSS_KC_BY_ID = Object.fromEntries(BOSS_KCS.map(b => [b.id, b]));

function isBossKc(id) { return !!BOSS_KC_BY_ID[id]; }
function hiscoreLabel(id) {
  if (id === "overall") return "Total level leaderboard";
  if (isBossKc(id)) return `${BOSS_KC_BY_ID[id].label} KC leaderboard`;
  return `${skillLabel(id)} XP leaderboard`;
}
function categoryIcon(s) {
  if (s.bossKey) return bossSpriteHtml(s.bossKey, "is-pill");
  return `<span class="st-pill-emoji">${escapeHtml(s.icon || "")}</span>`;
}

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
      <p class="st-page-sub">${escapeHtml(hiscoreLabel(state.skill))}.</p>

      <div class="st-filters">
        ${filterRow("Category", [
          { id: "overall", label: "Overall", icon: "📊" },
          ...SKILLS.map(s => ({ id: s.id, label: s.label, icon: s.icon })),
          ...BOSS_KCS.map(b => ({ id: b.id, label: b.label, iconHtml: categoryIcon(b) }))
        ], state.skill, "data-skill")}
        ${filterRow("Account", ACCOUNT_TYPES, state.type, "data-type", { row: true })}
      </div>

      <div class="st-card" style="margin-top:18px">
        ${rows.length ? renderTable(rows, state) : `<div class="st-empty">No players in this category yet.</div>`}
        ${renderPager(rows.length, state)}
      </div>
    </div>
  `;
  renderBossSprites($page);
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
  if (isBossKc(state.skill)) {
    return `<table class="st-table">
      <thead><tr><th>Rank</th><th>Slime</th><th class="num">KC</th></tr></thead>
      <tbody>${rows.map(r => {
        const rank = r.rk + state.offset;
        const cls = rank === 1 ? "rank-r1" : rank === 2 ? "rank-r2" : rank === 3 ? "rank-r3" : "";
        return `
        <tr onclick="location.hash='#player?name=${encodeURIComponent(r.name)}'">
          <td class="rank-cell ${cls}">#${nf(rank)}</td>
          <td>${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}<a href="#player?name=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a></td>
          <td class="num">${nf(r.kc_val || 0)}</td>
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
