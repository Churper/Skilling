import { escapeHtml } from "../lib/nav.js";
import { api } from "../lib/api.js";
import { timeAgo, nf } from "../lib/format.js";

export async function renderPlayers($page) {
  $page.innerHTML = `
    <div class="shell">
      <h1 class="st-page-title">Players</h1>
      <p class="st-page-sub">Search above, or browse the most recently tracked.</p>

      <div class="st-card">
        <div class="st-card-head"><div class="st-card-title">Most recently tracked</div></div>
        <div id="recent" class="st-loading">Loading…</div>
      </div>
    </div>`;
  try {
    const r = await api.newUsers(50);
    const rows = r?.rows || [];
    const host = $page.querySelector("#recent");
    if (!host) return;
    if (!rows.length) { host.outerHTML = `<div class="st-empty">No tracked slimes yet.</div>`; return; }
    host.outerHTML = `<table class="st-table">
      <thead><tr><th>Slime</th><th class="num">Total Level</th><th class="num">First tracked</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr onclick="location.hash='#player?name=${encodeURIComponent(r.name)}'">
          <td>${r.is_sapling ? `<span class="st-sap">🌱</span>` : ""}<a href="#player?name=${encodeURIComponent(r.name)}">${escapeHtml(r.name)}</a></td>
          <td class="num">${nf(r.total_level || 0)}</td>
          <td class="num muted">${timeAgo(r.first_tracked)}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
  } catch (e) {
    const host = $page.querySelector("#recent");
    if (host) host.outerHTML = `<div class="st-error">${escapeHtml(e.message || e)}</div>`;
  }
}
